import { getDbInstance, doc, getDoc, setDoc, serverTimestamp } from "../firebase";
import { ai } from "../lib/gemini";
import { Type } from "@google/genai";
import { cleanTitle } from "../lib/utils";

export interface MovieDetails {
  videoId?: string;
  title: string;
  overview: string;
  releaseDate: string;
  rating: number;
  genres: string[];
  runtime?: string;
  cast?: string[];
  director?: string;
  tmdbUrl?: string;
  germanInfoUrl?: string;
  customSearchTitle?: string;
  cachedAt?: any;
}

export async function fetchMovieInfo(title: string, videoId?: string, forceRefresh = false): Promise<MovieDetails | null> {
  let finalSearchTitle = cleanTitle(title);
  let customSearchTitle: string | undefined = undefined;

  // 1. Check Firestore cache first if videoId is provided
  if (videoId) {
    try {
      const dbRef = getDbInstance();
      const cacheRef = doc(dbRef, 'movieDetails', videoId);
      const cacheSnap = await getDoc(cacheRef);
      if (cacheSnap.exists()) {
        const data = cacheSnap.data() as MovieDetails;
        customSearchTitle = data.customSearchTitle;
        if (customSearchTitle) {
          finalSearchTitle = customSearchTitle;
        }
        if (!forceRefresh && data.overview) {
          console.log(`Using cached info for: ${title}`, data);
          return data;
        }
      }
    } catch (err) {
      console.error("Error checking cache:", err);
    }
  }

  // 2. If not in cache or forcing refresh, fetch using Gemini API from frontend
  try {
    console.log(`[MovieInfo] Requesting AI info for: "${finalSearchTitle}" (original: "${title}")`);
    
    const prompt = `Finde präzise Filminformationen. Der originale YouTube-Titel lautet: "${title}".
    Ein extrahierter Suchbegriff ist: "${finalSearchTitle}".
    Suche nach dem offiziellen Film, der am besten zu diesem YouTube-Titel passt. Oft handelt es sich um Spielfilme, die auf YouTube hochgeladen wurden.
    Gib die detaillierten Informationen auf Deutsch zurück.
    WICHTIG: Erfinde keine Filme oder Handlungen! Wenn du den Film absolut nicht in der Datenbank oder im Web findest, gib ein JSON-Objekt mit dem Titel "${finalSearchTitle}" und "N/A" Feldern zurück.
    Gib im Feld "title" NUR den offiziellen Filmtitel zurück.`;

    const result = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            overview: { type: Type.STRING },
            rating: { type: Type.NUMBER },
            releaseDate: { type: Type.STRING },
            runtime: { type: Type.STRING },
            genres: { type: Type.ARRAY, items: { type: Type.STRING } },
            director: { type: Type.STRING },
            cast: { type: Type.ARRAY, items: { type: Type.STRING } },
            tmdbUrl: { type: Type.STRING },
            germanInfoUrl: { type: Type.STRING }
          },
          required: ["title", "overview", "rating", "releaseDate", "runtime", "genres", "director", "cast"]
        },
      },
    });

    let responseText = result.text || "{}";
    const movieDetails = JSON.parse(responseText) as MovieDetails;
    
    // 3. Save to Firestore cache if videoId is provided
    if (videoId && movieDetails) {
      try {
        await setDoc(doc(getDbInstance(), 'movieDetails', videoId), {
          ...movieDetails,
          videoId,
          customSearchTitle: customSearchTitle || null,
          cachedAt: serverTimestamp()
        });
        console.log(`Cached info for: ${title}`);
      } catch (err) {
        console.error("Error saving to Firestore cache:", err);
      }
    }

    return movieDetails;
  } catch (error: any) {
    console.error("Detailed error in fetchMovieInfo for title:", title, error);
    if (error.message?.includes("API_KEY_INVALID") || error.message?.includes("PERMISSION_DENIED")) {
        console.error("Gemini API Key issues. Please check Settings > Secrets.");
    }
    return null;
  }
}
