import React, { useEffect, useState } from "react";
import {
  GlassSheet,
  GlassListRow,
  GlassSlider,
  GlassToggle,
  GlassBadge,
  GlassDivider,
  GlassButton,
  GlassSegmentedControl,
  useMaterialIntensity,
  useDockPosition,
  describeMaterialIntensity,
  SettingsIcon,
  MoonIcon,
  BatteryIcon,
  getDeviceProfile,
  getEmbeddedPlayerSupport,
  type RuntimeDeviceProfile,
  type DockPosition,
} from "@/shared";

export interface SettingsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsSheet: React.FC<SettingsSheetProps> = ({ isOpen, onClose }) => {
  const { intensity, setIntensity } = useMaterialIntensity();
  const { dockPosition, setDockPosition } = useDockPosition();
  const [isDark, setIsDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  const [autoStart, setAutoStart] = useState(true);
  const [batteryOptimization, setBatteryOptimization] = useState(true);
  const [deviceProfile, setDeviceProfile] = useState<RuntimeDeviceProfile | null | undefined>();
  const [nativePlayerReady, setNativePlayerReady] = useState(false);

  useEffect(() => {
    let active = true;
    void getDeviceProfile()
      .then((profile) => {
        if (active) setDeviceProfile(profile);
      })
      .catch(() => {
        if (active) setDeviceProfile(null);
      });
    void getEmbeddedPlayerSupport()
      .then((support) => {
        if (active) setNativePlayerReady(support.available);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const handleThemeChange = (nextDark: boolean) => {
    setIsDark(nextDark);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", nextDark);
    }
  };

  return (
    <GlassSheet
      isOpen={isOpen}
      onClose={onClose}
      title="대시보드 설정"
      description="Novus 스마트 디스플레이 환경을 기기 사양에 맞게 조정합니다."
      side="right"
      width={420}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
          <GlassButton variant="primary" size="md" onClick={onClose}>
            완료
          </GlassButton>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* 인앱 플레이어 독 위치 설정 */}
        <section>
          <GlassDivider label="인앱 플레이어 & 내비게이션 독" size="md" />
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <label
              style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)" }}
            >
              태블릿 독(Dock) 위치
            </label>
            <p
              style={{
                fontSize: "12px",
                color: "var(--color-text-secondary)",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              앱 실행 중 홈 복귀, 뒤로가기, 새로고침 및 상태를 표시하는 내비게이션 바의 위치를
              지정합니다.
            </p>
            <GlassSegmentedControl<DockPosition>
              options={[
                { id: "right", label: "오른쪽 (기본)" },
                { id: "left", label: "왼쪽" },
                { id: "bottom", label: "하단" },
              ]}
              value={dockPosition}
              onChange={setDockPosition}
            />
          </div>
        </section>

        {/* 디스플레이 & 머티리얼 */}
        <section>
          <GlassDivider label="비주얼 & 머티리얼" size="md" />
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <GlassSlider
              value={intensity}
              onChange={setIntensity}
              min={0}
              max={100}
              step={5}
              label={`머티리얼 강도 (${describeMaterialIntensity(intensity)})`}
              formatValue={(val) => `${val}%`}
            />
            <p
              style={{
                fontSize: "11px",
                color: "var(--color-text-secondary)",
                margin: "0 0 8px 0",
              }}
            >
              * 0%는 저사양 완벽 불투명 모드로 GPU 연산 부담이 전혀 없습니다.
            </p>

            <GlassListRow
              label="다크 모드"
              description="야간 및 저조도 환경을 위한 고대비 다크 테마"
              leading={<MoonIcon size={18} />}
              trailing={
                <GlassToggle
                  checked={isDark}
                  onChange={handleThemeChange}
                  aria-label="다크 모드 전환"
                />
              }
            />
          </div>
        </section>

        {/* 시스템 & 전원 최적화 */}
        <section>
          <GlassDivider label="시스템 & 전원" size="md" />
          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <GlassListRow
              label="부팅 시 자동 시작"
              description="PC 부팅 시 Novus 홈 화면을 첫 화면으로 실행"
              leading={<SettingsIcon size={18} />}
              trailing={
                <GlassToggle
                  checked={autoStart}
                  onChange={setAutoStart}
                  aria-label="부팅 시 자동 시작"
                />
              }
            />

            <GlassListRow
              label="배터리 스웰링 방지 모드"
              description="상시 거치 시 배터리 수명 보호 및 발열 억제"
              leading={<BatteryIcon size={18} />}
              trailing={
                <GlassToggle
                  checked={batteryOptimization}
                  onChange={setBatteryOptimization}
                  aria-label="배터리 수명 보호 모드"
                />
              }
            />
          </div>
        </section>

        {/* 실행 중인 기기 정보 */}
        <section>
          <GlassDivider label="현재 나의 기기" size="md" />
          <div className="settings-device-card">
            <div className="settings-device-card__head">
              <span className="settings-device-card__icon" aria-hidden="true">
                <SettingsIcon size={24} />
              </span>
              <div className="settings-device-card__identity">
                <span>이 기기에서 실행 중</span>
                <strong>
                  {deviceProfile === undefined
                    ? "기기 정보 확인 중…"
                    : deviceProfile
                      ? [deviceProfile.manufacturer, deviceProfile.model]
                          .filter(Boolean)
                          .join(" ") ||
                        deviceProfile.device_name ||
                        "내 컴퓨터"
                      : "기기 정보를 읽을 수 없습니다"}
                </strong>
                {deviceProfile?.device_name && <small>{deviceProfile.device_name}</small>}
              </div>
              {deviceProfile && (
                <GlassBadge variant="primary" size="sm">
                  자동 감지
                </GlassBadge>
              )}
            </div>
            {deviceProfile && (
              <dl className="settings-device-card__specs">
                <div>
                  <dt>운영체제</dt>
                  <dd>{deviceProfile.os_version || deviceProfile.os_family}</dd>
                </div>
                <div>
                  <dt>프로세서</dt>
                  <dd>{deviceProfile.cpu_name || "확인할 수 없음"}</dd>
                </div>
                <div>
                  <dt>메모리</dt>
                  <dd>{formatMemory(deviceProfile.memory_bytes)}</dd>
                </div>
                <div>
                  <dt>아키텍처 · 논리 코어</dt>
                  <dd>
                    {deviceProfile.architecture} · {deviceProfile.logical_cores}개
                  </dd>
                </div>
                <div>
                  <dt>로컬 영상 재생</dt>
                  <dd>{nativePlayerReady ? "libmpv 파일 감지" : "현재 WebView 경로"}</dd>
                </div>
              </dl>
            )}
          </div>
        </section>
      </div>
    </GlassSheet>
  );
};

GlassSheet.displayName = "SettingsSheet";

function formatMemory(bytes: number | null): string {
  if (bytes === null) return "확인할 수 없음";
  const gib = bytes / 1024 ** 3;
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(gib)} GB`;
}
