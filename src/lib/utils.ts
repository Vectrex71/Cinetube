import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks whether a title is a clickbait description or teaser phrase rather than a real movie name
 */
export function isClickbaitTitle(title?: string): boolean {
  if (!title) return false;
  const t = title.trim();
  if (t.toLowerCase() === 'n/a' || t.toLowerCase() === 'null') return true;

  // Obvious clickbait shouts / interjections
  if (/^(BOOM!|SO WITZIG!|Grandios!|ACHTUNG!|UFF!|STARBESETZUNG!|Wahnsinn!|Stark!|Toller Film!|Diesen Thriller|Großartig!|Unglaublich spannend!)/i.test(t)) {
    return true;
  }

  // Clickbait teaser phrases and sentences
  if (/harte AB 18|Actionkracher haut voll rein|auf die falsche Fährte locken|ist hochspannend|Comedy mit Starbesetzung|Ein ACTION Sci-Fi Film|Düsterer Zukunfts-Thriller|POSTAPOKALYPTISCHER Thriller|wird dich.*erwischen|muss man.*gesehen haben|haut ordentlich rein|super spannend/i.test(t)) {
    return true;
  }

  return false;
}

/**
 * Robustly extracts the authentic movie title from YouTube video titles with clickbait,
 * channel tags (Moviedome, Netzkino), parenthetical notes, genre shouts, and delimiters.
 */
export function cleanTitle(title: string): string {
  if (!title) return '';

  let cleaned = title.trim();

  // Strip common file extensions
  cleaned = cleaned.replace(/\.(mp4|mkv|avi|mov|wmv|flv|webm|ts|m4v)$/i, '');

  // Strip leading numbering/index only if followed by dot/dash/hash e.g. "01 - ", "01. ", "#1 " (never plain numbers like "15 Killings" or "300")
  cleaned = cleaned.replace(/^#\d+\s*[:\-.\s]\s*/, '');
  cleaned = cleaned.replace(/^\d+[\.:\-]\s+/, '');

  // Replace underscores with spaces
  cleaned = cleaned.replace(/_/g, ' ');

  // 1. Explicit movie title in parenthesis/brackets:
  // e.g. "... (Ganzer Film: The Marine 6)" or "(Film: Infernal Affairs)" or "(Titel: ...)"
  const explicitMatch = cleaned.match(/[\(\[][^\)\]]*(?:ganzer film|film|titel)\s*:\s*([^\)\]]+)[\)\]]/i);
  if (explicitMatch && explicitMatch[1]) {
    const candidate = explicitMatch[1].trim();
    if (candidate.length > 1 && !/^(deutsch|kostenlos|hd|4k|in voller l[äa]nge|in hd)$/i.test(candidate)) {
      return cleanTitle(candidate);
    }
  }

  // 2. Colon separator:
  // Check if prefix is a teaser/clickbait phrase
  if (cleaned.includes(': ')) {
    const colonParts = cleaned.split(': ');
    const prefix = colonParts[0].trim();
    const rest = colonParts.slice(1).join(': ').trim();

    const isTeaserPrefix = /unglaublich|perfekt|dieser|dieses|diese|einheimische|eine welt|ein mann|ein horrorfilm|ein film [uü]ber|er wuchs|werden|wird|ist einfach|ist genial|ist ein|meisterwerk|knaller|kracher|hammer|muss man|sehenswert|tierhorror|sci-fi|blockbuster|endzeit|survival horror|folk horror|katastrophenfilm|actionkracher|action[-\s]thriller|action[-\s]abenteuer|crime[-\s]thriller|mit\s+[A-ZÄÖÜ]|im\s+mittelalter|aus\s+dem\s+labor|auf\s+einer\s+einsamen|boom|so witzig|achtung|grandios|uff|starbesetzung/i.test(prefix);

    const isSeriesPrefix = /^(die festung\s+[ivx\d]+|bunker\s+\d+|[0-9]+\s+outlaws|agatha christie|star trek|star wars|sherlock holmes)$/i.test(prefix);

    if (isTeaserPrefix && !isSeriesPrefix && rest.length > 2) {
      return cleanTitle(rest);
    }

    // ALL CAPS title where rest is a plot sentence
    if (/^[A-Z0-9\s&'\-!]{3,}$/.test(prefix) && /^[A-ZÄÖÜ][a-zäöüß]/.test(rest) && rest.split(' ').length > 4) {
      return cleanTitle(prefix);
    }
  }

  // 3. Remove leading clickbait emojis & tags (Extended_Pictographic preserves numbers 0-9)
  cleaned = cleaned.replace(/^[\s\p{Extended_Pictographic}]+/u, '');
  cleaned = cleaned.replace(/^\[(hd|4k|ganzer film|film|kostenlos)\]\s*/i, '');

  // 4. Pipe separator:
  if (cleaned.includes('|')) {
    const pipeParts = cleaned.split('|').map(p => p.trim());
    if (/^(actionkracher|horror|thriller|action|western|sci-fi|komödie|drama|ganzer film|film|movie)$/i.test(pipeParts[0])) {
      return cleanTitle(pipeParts[1] || cleaned);
    }
    if (/unglaublich|spannung|meisterwerk|sehenswert|hammer|kracher/i.test(pipeParts[0]) && pipeParts[1]) {
      return cleanTitle(pipeParts[1]);
    }
    cleaned = pipeParts[0];
  }

  // 5. Remove all square brackets tags like [Thriller], [Crime], [Sci-Fi], [HD], [Deutsch]
  cleaned = cleaned.replace(/\s*\[[^\]]*\]/g, '');

  // 6. Parentheses containing video metadata
  cleaned = cleaned.replace(/\s*[\(\[][^\)\]]*(?:ganzer film|kompletter film|in voller l[äa]nge|deutsch|german|kostenlos|filmise|netzkino|moviedome|hd|4k|film auf deutsch|filme deutsch|filme nach wahren|thriller|horror|action|sci-fi|drama|kom[öo]die|western|krimi|abenteuer|begebenheiten|\d{4})[^\)\]]*[\)\]]/gi, '');

  // 7. Trailing delimiters like " - Ganzer Film...", " – packender Action..."
  cleaned = cleaned.replace(/\s*[-–—]\s*(?:ganzer film|kompletter film|in voller l[äa]nge|film auf deutsch|deutscher film|kostenlos|auf deutsch|deutsch|in hd|hd|kult-horrorfilm|packender action|spannender actionkracher|sie sind vor den aliens).*$/i, '');

  // 8. Trailing year or HD
  cleaned = cleaned.replace(/\s*\(\d{4}\)\s*$/, '');
  cleaned = cleaned.replace(/\s*\(?(hd|4k|uhd)\)?\s*$/i, '');

  // 9. Trailing or leading punctuation
  cleaned = cleaned.replace(/^[:\-\s–—|]+|[:\-\s–—|]+$/g, '').trim();

  // If title was in ALL CAPS, convert to Title Case
  if (cleaned.length > 3 && cleaned === cleaned.toUpperCase() && !/^[A-Z0-9]{1,4}$/.test(cleaned)) {
    cleaned = cleaned.split(' ').map(w => {
      if (w.includes('-')) {
        return w.split('-').map(sub => sub.charAt(0).toUpperCase() + sub.slice(1).toLowerCase()).join('-');
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join(' ');
  }

  return cleaned.trim();
}

/**
 * Returns the best authentic movie title:
 * Rejects clickbait phrases from database details and falls back to smartly cleaned title.
 */
export function getValidMovieTitle(detailsTitle?: string, youtubeTitle?: string): string {
  if (detailsTitle && typeof detailsTitle === 'string') {
    const trimmed = detailsTitle.trim();
    if (trimmed.length > 0 && !isClickbaitTitle(trimmed)) {
      return trimmed;
    }
  }
  return cleanTitle(youtubeTitle || '') || youtubeTitle || '';
}

/**
 * Genre mappings to consolidate variations (Familie/Familienfilm, Krieg/Kriegsfilm, Krimi/Kriminalfilm, Romance/Romantik)
 */
export const GENRE_MAPPING: Record<string, string> = {
  // Familie & Familienfilm
  'familie': 'Familienfilm',
  'familienfilm': 'Familienfilm',
  'family': 'Familienfilm',

  // Krieg & Kriegsfilm
  'krieg': 'Kriegsfilm',
  'kriegsfilm': 'Kriegsfilm',
  'war': 'Kriegsfilm',

  // Krimi & Kriminalfilm & Spionage
  'krimi': 'Krimi',
  'kriminalfilm': 'Krimi',
  'crime': 'Krimi',
  'spionage': 'Krimi',
  'spy': 'Krimi',
  'espionage': 'Krimi',

  // Romance & Romantik & Liebesfilm
  'romance': 'Romantik',
  'romantik': 'Romantik',
  'romanze': 'Romantik',
  'liebesfilm': 'Romantik',

  // Historie & Historienfilm
  'historie': 'Historienfilm',
  'historienfilm': 'Historienfilm',
  'history': 'Historienfilm',

  // Musik, Musical & Musikfilm
  'musik': 'Musikfilm',
  'music': 'Musikfilm',
  'musical': 'Musikfilm',
  'musikfilm': 'Musikfilm',

  // Sci-Fi
  'science fiction': 'Sci-Fi',
  'science-fiction': 'Sci-Fi',
  'scince fiction': 'Sci-Fi',
  'sci-fi': 'Sci-Fi',
  'scifi': 'Sci-Fi',

  // Komödie
  'kom$die': 'Komödie',
  'komödie': 'Komödie',
  'comedy': 'Komödie',

  // Mystery & Mysterythriller
  'mystery': 'Mystery',
  'mysterythriller': 'Mystery',
  'mystery-thriller': 'Mystery',
  'mystery thriller': 'Mystery',

  // Horror & Slasher
  'horror': 'Horror',
  'slasher': 'Horror',
  'slasherfilm': 'Horror',
  'slasher-film': 'Horror',
  'slasher film': 'Horror',

  // Animation
  'animated': 'Animation',
  'animation': 'Animation',
  'anime': 'Animation',

  // Abenteuer
  'adventure': 'Abenteuer',
  'abenteuer': 'Abenteuer'
};

export const EXCLUDED_GENRES = new Set([
  'christlicher film',
  'glaube',
  'glauben',
  'fernsehfilm',
  'found footage',
  'dystopie',
  'information',
  'kampfsport',
  'privat',
  'unbekannt',
  'cast',
  'tv-film',
  'anthologie',
  'trash',
  'dokumentation',
  'dokumentarfilm',
  'documentary'
]);

export function normalizeGenre(genre: string): string {
  if (!genre) return '';
  const trimmed = genre.trim();
  const lower = trimmed.toLowerCase();
  if (GENRE_MAPPING[lower]) {
    return GENRE_MAPPING[lower];
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function isExcludedGenre(genre: string): boolean {
  if (!genre) return true;
  const lower = genre.trim().toLowerCase();
  return EXCLUDED_GENRES.has(lower);
}


