use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct DeviceProfile {
    pub os_family: &'static str,
    pub os_version: Option<String>,
    pub architecture: &'static str,
    pub device_name: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub cpu_name: Option<String>,
    pub logical_cores: usize,
    pub memory_bytes: Option<u64>,
}

impl DeviceProfile {
    pub fn detect() -> Self {
        let mut profile = Self {
            os_family: std::env::consts::OS,
            os_version: None,
            architecture: std::env::consts::ARCH,
            device_name: None,
            manufacturer: None,
            model: None,
            cpu_name: None,
            logical_cores: std::thread::available_parallelism()
                .map(|count| count.get())
                .unwrap_or(1),
            memory_bytes: None,
        };

        #[cfg(target_os = "macos")]
        macos::fill(&mut profile);
        #[cfg(target_os = "windows")]
        windows::fill(&mut profile);

        profile
    }
}

#[tauri::command]
pub fn get_device_profile(profile: tauri::State<'_, DeviceProfile>) -> DeviceProfile {
    profile.inner().clone()
}

#[cfg(target_os = "macos")]
mod macos {
    use super::DeviceProfile;
    use std::ffi::{c_char, c_int, c_void, CStr, CString};
    use std::process::Command;

    extern "C" {
        fn sysctlbyname(
            name: *const c_char,
            old_value: *mut c_void,
            old_size: *mut usize,
            new_value: *const c_void,
            new_size: usize,
        ) -> c_int;
        fn gethostname(name: *mut c_char, length: usize) -> c_int;
    }

    fn sysctl_bytes(key: &str) -> Option<Vec<u8>> {
        let key = CString::new(key).ok()?;
        let mut size = 0usize;
        if unsafe {
            sysctlbyname(
                key.as_ptr(),
                std::ptr::null_mut(),
                &mut size,
                std::ptr::null(),
                0,
            )
        } != 0
            || size == 0
            || size > 4096
        {
            return None;
        }
        let mut bytes = vec![0u8; size];
        if unsafe {
            sysctlbyname(
                key.as_ptr(),
                bytes.as_mut_ptr().cast(),
                &mut size,
                std::ptr::null(),
                0,
            )
        } != 0
        {
            return None;
        }
        bytes.truncate(size);
        Some(bytes)
    }

    fn sysctl_string(key: &str) -> Option<String> {
        let bytes = sysctl_bytes(key)?;
        let end = bytes
            .iter()
            .position(|byte| *byte == 0)
            .unwrap_or(bytes.len());
        let value = String::from_utf8_lossy(&bytes[..end]).trim().to_owned();
        (!value.is_empty()).then_some(value)
    }

    fn sysctl_u64(key: &str) -> Option<u64> {
        let bytes = sysctl_bytes(key)?;
        let array: [u8; 8] = bytes.get(..8)?.try_into().ok()?;
        Some(u64::from_ne_bytes(array))
    }

    fn hostname() -> Option<String> {
        let mut bytes = [0i8; 256];
        if unsafe { gethostname(bytes.as_mut_ptr(), bytes.len()) } != 0 {
            return None;
        }
        bytes[255] = 0;
        let value = unsafe { CStr::from_ptr(bytes.as_ptr()) }
            .to_string_lossy()
            .trim()
            .to_owned();
        (!value.is_empty()).then_some(value)
    }

    pub fn fill(profile: &mut DeviceProfile) {
        profile.device_name = hostname();
        profile.manufacturer = Some("Apple".into());
        profile.model = sysctl_string("hw.model");
        profile.cpu_name = sysctl_string("machdep.cpu.brand_string").or_else(|| {
            Some(if profile.architecture == "aarch64" {
                "Apple Silicon".to_string()
            } else {
                format!("{} 프로세서", profile.architecture)
            })
        });
        profile.memory_bytes = sysctl_u64("hw.memsize");
        profile.os_version = Command::new("/usr/bin/sw_vers")
            .arg("-productVersion")
            .output()
            .ok()
            .filter(|output| output.status.success())
            .map(|output| format!("macOS {}", String::from_utf8_lossy(&output.stdout).trim()))
            .filter(|version| !version.is_empty());
    }
}

#[cfg(target_os = "windows")]
mod windows {
    use super::DeviceProfile;
    use std::ffi::c_void;
    use std::os::windows::ffi::OsStrExt;

    const HKEY_LOCAL_MACHINE: isize = 0x8000_0002u32 as i32 as isize;
    const RRF_RT_REG_SZ: u32 = 0x0000_0002;

    #[repr(C)]
    struct MemoryStatus {
        length: u32,
        memory_load: u32,
        total_physical: u64,
        available_physical: u64,
        total_page_file: u64,
        available_page_file: u64,
        total_virtual: u64,
        available_virtual: u64,
        available_extended_virtual: u64,
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn GlobalMemoryStatusEx(status: *mut MemoryStatus) -> i32;
    }

    #[link(name = "advapi32")]
    extern "system" {
        fn RegGetValueW(
            key: isize,
            subkey: *const u16,
            value: *const u16,
            flags: u32,
            value_type: *mut u32,
            data: *mut c_void,
            size: *mut u32,
        ) -> i32;
    }

    fn wide(value: &str) -> Vec<u16> {
        std::ffi::OsStr::new(value)
            .encode_wide()
            .chain(Some(0))
            .collect()
    }

    fn registry_string(subkey: &str, value: &str) -> Option<String> {
        let subkey = wide(subkey);
        let value = wide(value);
        let mut size = 0u32;
        if unsafe {
            RegGetValueW(
                HKEY_LOCAL_MACHINE,
                subkey.as_ptr(),
                value.as_ptr(),
                RRF_RT_REG_SZ,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                &mut size,
            )
        } != 0
            || size < 2
            || size > 8192
        {
            return None;
        }
        let mut buffer = vec![0u16; size as usize / 2];
        if unsafe {
            RegGetValueW(
                HKEY_LOCAL_MACHINE,
                subkey.as_ptr(),
                value.as_ptr(),
                RRF_RT_REG_SZ,
                std::ptr::null_mut(),
                buffer.as_mut_ptr().cast(),
                &mut size,
            )
        } != 0
        {
            return None;
        }
        let end = buffer
            .iter()
            .position(|unit| *unit == 0)
            .unwrap_or(buffer.len());
        let text = String::from_utf16_lossy(&buffer[..end]).trim().to_owned();
        (!text.is_empty()).then_some(text)
    }

    fn total_memory() -> Option<u64> {
        let mut status = MemoryStatus {
            length: std::mem::size_of::<MemoryStatus>() as u32,
            memory_load: 0,
            total_physical: 0,
            available_physical: 0,
            total_page_file: 0,
            available_page_file: 0,
            total_virtual: 0,
            available_virtual: 0,
            available_extended_virtual: 0,
        };
        (unsafe { GlobalMemoryStatusEx(&mut status) } != 0).then_some(status.total_physical)
    }

    fn hardware_label(value: Option<String>) -> Option<String> {
        value.filter(|text| {
            let normalized = text.to_ascii_lowercase();
            !normalized.contains("to be filled")
                && !normalized.contains("default string")
                && normalized != "system product name"
        })
    }

    pub fn fill(profile: &mut DeviceProfile) {
        const BIOS: &str = r"HARDWARE\DESCRIPTION\System\BIOS";
        const CPU: &str = r"HARDWARE\DESCRIPTION\System\CentralProcessor\0";
        const OS: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion";

        profile.device_name = std::env::var("COMPUTERNAME")
            .ok()
            .filter(|name| !name.trim().is_empty());
        profile.manufacturer = hardware_label(registry_string(BIOS, "SystemManufacturer"));
        profile.model = hardware_label(registry_string(BIOS, "SystemProductName"));
        profile.cpu_name = registry_string(CPU, "ProcessorNameString");
        profile.memory_bytes = total_memory();

        let build = registry_string(OS, "CurrentBuildNumber");
        let release = registry_string(OS, "DisplayVersion");
        let generation = build
            .as_deref()
            .and_then(|value| value.parse::<u32>().ok())
            .map(|value| {
                if value >= 22000 {
                    "Windows 11"
                } else {
                    "Windows 10"
                }
            })
            .unwrap_or("Windows");
        profile.os_version = Some(match (release, build) {
            (Some(release), Some(build)) => format!("{generation} {release} · 빌드 {build}"),
            (None, Some(build)) => format!("{generation} · 빌드 {build}"),
            _ => generation.to_owned(),
        });
    }
}
