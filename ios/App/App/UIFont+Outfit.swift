import UIKit

extension UIFont {
    
    /// Returns an Outfit font with the specified size and weight
    /// Falls back to system font if Outfit is not available
    static func outfitFont(ofSize size: CGFloat, weight: UIFont.Weight = .regular) -> UIFont {
        let fontName: String
        
        switch weight {
        case .ultraLight, .thin, .light:
            fontName = "Outfit-Light"
        case .regular:
            fontName = "Outfit-Regular"
        case .medium:
            fontName = "Outfit-Medium"
        case .semibold:
            fontName = "Outfit-SemiBold"
        case .bold, .heavy, .black:
            fontName = "Outfit-Bold"
        default:
            fontName = "Outfit-Regular"
        }
        
        return UIFont(name: fontName, size: size) ?? UIFont.systemFont(ofSize: size, weight: weight)
    }
    
    /// Returns an Outfit font for the specified text style
    /// Falls back to preferred font if Outfit is not available
    static func outfitFont(forTextStyle style: UIFont.TextStyle) -> UIFont {
        let preferredFont = UIFont.preferredFont(forTextStyle: style)
        let size = preferredFont.pointSize
        
        let weight: UIFont.Weight
        switch style {
        case .largeTitle, .title1:
            weight = .bold
        case .title2, .title3:
            weight = .semibold
        case .headline:
            weight = .semibold
        case .subheadline:
            weight = .medium
        case .body, .callout:
            weight = .regular
        case .footnote, .caption1, .caption2:
            weight = .light
        default:
            weight = .regular
        }
        
        return outfitFont(ofSize: size, weight: weight)
    }
    
    /// Convenience methods for common font sizes
    static var outfitLargeTitle: UIFont {
        return outfitFont(forTextStyle: .largeTitle)
    }
    
    static var outfitTitle1: UIFont {
        return outfitFont(forTextStyle: .title1)
    }
    
    static var outfitTitle2: UIFont {
        return outfitFont(forTextStyle: .title2)
    }
    
    static var outfitTitle3: UIFont {
        return outfitFont(forTextStyle: .title3)
    }
    
    static var outfitHeadline: UIFont {
        return outfitFont(forTextStyle: .headline)
    }
    
    static var outfitSubheadline: UIFont {
        return outfitFont(forTextStyle: .subheadline)
    }
    
    static var outfitBody: UIFont {
        return outfitFont(forTextStyle: .body)
    }
    
    static var outfitCallout: UIFont {
        return outfitFont(forTextStyle: .callout)
    }
    
    static var outfitFootnote: UIFont {
        return outfitFont(forTextStyle: .footnote)
    }
    
    static var outfitCaption1: UIFont {
        return outfitFont(forTextStyle: .caption1)
    }
    
    static var outfitCaption2: UIFont {
        return outfitFont(forTextStyle: .caption2)
    }
}