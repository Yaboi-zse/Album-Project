// ścieżka: youtube-clip-server/server.js

const express = require("express");
const cors = require("cors");
const ytdl = require("ytdl-core");

const app = express();
const port = 4000;

// === WAŻNA ZMIANA ===
// Konfigurujemy CORS, aby akceptował żądania TYLKO z Twojej aplikacji Next.js.
// Zakładając, że Twoja aplikacja działa na porcie 3000.
app.use(cors({
  origin: 'http://localhost:3000' 
}));

app.get("/download", async (req, res) => {
  const { videoId } = req.query;

  // Sprawdzamy, czy videoId istnieje i jest prawidłowe
  if (!videoId || typeof videoId !== 'string' || !ytdl.validateID(videoId)) {
    return res.status(400).send("Nieprawidłowe lub brakujące ID filmu.");
  }

  try {
    const info = await ytdl.getInfo(videoId);
    // Szukamy formatu, który ma i wideo, i audio
    const format = ytdl.chooseFormat(info.formats, {
      quality: "highest",
      filter: (f) => f.container === "mp4" && f.hasAudio && f.hasVideo,
    });

    if (format) {
      res.json({ url: format.url });
    } else {
      // Jeśli nie ma idealnego formatu, szukamy najlepszego wideo i audio osobno (bardziej zaawansowane)
      // Na razie zwracamy błąd
      res.status(404).send("Nie znaleziono formatu MP4 z wideo i audio.");
    }
  } catch (error) {
    console.error("Błąd w ytdl-core:", error);
    res.status(500).send("Nie udało się pobrać informacji o filmie.");
  }
});

app.listen(port, () => {
  console.log(`Serwer proxy dla klipów YouTube działa na http://localhost:${port}`);
});
