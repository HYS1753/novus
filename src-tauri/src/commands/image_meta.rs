//! Image metadata shared by the gallery and the thumbnail cache.
//!
//! Both sides honour EXIF orientation, so the dimensions the gallery lays
//! out with always match the pixels the thumbnail shows (a phone photo shot
//! upright is tall in both).

use image::metadata::Orientation;
use image::{DynamicImage, ImageDecoder, ImageReader};

fn swaps_axes(orientation: Orientation) -> bool {
    matches!(
        orientation,
        Orientation::Rotate90
            | Orientation::Rotate270
            | Orientation::Rotate90FlipH
            | Orientation::Rotate270FlipH
    )
}

/// Displayed width and height, read from the file header only (no pixel decode).
/// `None` for formats the decoder cannot read (HEIC, SVG, AVIF, TIFF, …).
pub fn oriented_dimensions(path: &str) -> Option<(u32, u32)> {
    let reader = ImageReader::open(path).ok()?.with_guessed_format().ok()?;
    let mut decoder = reader.into_decoder().ok()?;
    let (width, height) = decoder.dimensions();
    if width == 0 || height == 0 {
        return None;
    }
    let orientation = decoder.orientation().unwrap_or(Orientation::NoTransforms);
    Some(if swaps_axes(orientation) {
        (height, width)
    } else {
        (width, height)
    })
}

/// Decodes the image and applies its EXIF orientation.
pub fn open_oriented(path: &str) -> Result<DynamicImage, String> {
    let reader = ImageReader::open(path)
        .map_err(|e| e.to_string())?
        .with_guessed_format()
        .map_err(|e| e.to_string())?;
    let mut decoder = reader.into_decoder().map_err(|e| e.to_string())?;
    let orientation = decoder.orientation().unwrap_or(Orientation::NoTransforms);
    let mut image = DynamicImage::from_decoder(decoder).map_err(|e| e.to_string())?;
    image.apply_orientation(orientation);
    Ok(image)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_dimensions_from_the_header() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("novus-dims-{unique}.png"));
        image::RgbImage::new(30, 20).save(&path).unwrap();
        let path_str = path.to_string_lossy().to_string();
        assert_eq!(oriented_dimensions(&path_str), Some((30, 20)));
        assert_eq!(open_oriented(&path_str).unwrap().width(), 30);
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn unreadable_files_have_no_dimensions() {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("novus-dims-{unique}.jpg"));
        std::fs::write(&path, b"not an image").unwrap();
        assert_eq!(oriented_dimensions(&path.to_string_lossy()), None);
        std::fs::remove_file(path).unwrap();
    }
}
