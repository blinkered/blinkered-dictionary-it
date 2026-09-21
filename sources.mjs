/**
 * The collections that attest Italian, and where each comes from.
 *
 * Italian is the best-supplied language in the queue and the numbers say why: a 40,944-word
 * candidate list — smaller than German's — against 432,609 Internet Archive texts and 1,109
 * Gutenberg books. German reached 99.6% on a list this size with a fraction of that shelf.
 *
 * One Leipzig package is deliberately absent. `ita_wikipedia_2021_1M` exists and downloads, and
 * it is Wikipedia text wearing a Leipzig label: including it would corroborate `wiki:it` while
 * looking like a fourth family. That is the exact failure the three-families rule is for.
 */
import { createReadStream, existsSync, readFileSync, readdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import {
  fileDocuments,
  fineweb2Documents,
  gutenbergBody,
  harvestDocuments,
  leipzigLocators,
  leipzigSentences,
  tatoebaDocuments,
  verseDocuments,
  wikiDocuments,
} from "@blinkered/attestation";

export const LANGUAGE = "it";

const CACHE = new URL(".cache/raw/", import.meta.url).pathname;

/** A Leipzig package, with its sentence-to-URL index resolved up front. */
function leipzig(pkg) {
  const base = `${CACHE}${pkg}/${pkg}`
  const locators = leipzigLocators(
    readFileSync(`${base}-inv_so.txt`, 'utf8'),
    readFileSync(`${base}-sources.txt`, 'utf8'),
  )
  const lines = createInterface({
    input: createReadStream(`${base}-sentences.txt`),
    crlfDelay: Infinity,
  })
  return leipzigSentences(lines, locators)
}

/** News only. See the note above about the Wikipedia-derived package. */
const LEIPZIG = ["ita_news_2024_1M", "ita_news_2023_1M", "ita_news_2022_1M"];

const ALL = [
  {
    id: "wiki:it",
    what: "Italian Wikipedia — modern encyclopedic prose",
    needs: `${CACHE}itwiki.xml.bz2`,
    documents: () => wikiDocuments(`${CACHE}itwiki.xml.bz2`),
  },
  {
    id: "wikisource:it",
    what: "Italian Wikisource — same Wikimedia family, so it corroborates rather than counts",
    needs: `${CACHE}itwikisource.xml.bz2`,
    documents: () => wikiDocuments(`${CACHE}itwikisource.xml.bz2`),
  },
  ...LEIPZIG.map((pkg) => ({
    id: `lz:${pkg}`,
    from: `https://downloads.wortschatz-leipzig.de/corpora/${pkg}.tar.gz`,
    what: `Leipzig ${pkg} — modern news, cited by the page each sentence came from`,
    needs: `${CACHE}${pkg}`,
    documents: () => leipzig(pkg),
  })),
  {
    id: "tat",
    from: "https://downloads.tatoeba.org/exports/per_language/ita/ita_sentences.tsv.bz2",
    what: "Tatoeba Italian — contemporary and conversational",
    needs: `${CACHE}ita_sentences.tsv`,
    documents: () => tatoebaDocuments(`${CACHE}ita_sentences.tsv`),
  },
  {
    id: "fw2",
    from: "https://huggingface.co/datasets/HuggingFaceFW/fineweb-2/resolve/main/data/ita_Latn/train/000_00000.parquet",
    what: "FineWeb-2 Italian — a web crawl nobody here made",
    needs: `${CACHE}fineweb2-ita.parquet`,
    documents: () => fineweb2Documents(`${CACHE}fineweb2-ita.parquet`),
  },
  {
    id: "gut",
    from: "https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv",
    what: "Project Gutenberg Italian, 1,109 texts",
    needs: `${CACHE}gutenberg-it`,
    documents: () => {
      const dir = `${CACHE}gutenberg-it`;
      const books = readdirSync(dir)
        .filter((file) => file.endsWith(".txt"))
        .map((file) => ({
          locator: file.replace(".txt", ""),
          path: `${dir}/${file}`,
        }));
      return fileDocuments(books, async (path) =>
        gutenbergBody(readFileSync(path, "utf8")),
      );
    },
  },
  {
    id: "ebible:ita1927",
    from: "https://ebible.org/Scriptures/ita1927_vpl.zip",
    what: "Riveduta 1927 — a family nothing else here belongs to",
    needs: `${CACHE}ebible-ita1927/ita1927_vpl.txt`,
    documents: () => verseDocuments(`${CACHE}ebible-ita1927/ita1927_vpl.txt`),
  },
  {
    id: "ia",
    // Scanned books are OCR, and OCR fails in a way that looks like text. Clean Gutenberg scores
    // a median 52% known words and never below 36%; the worst of these scored 1%, an English
    // book read as Cyrillic. Below this floor a book is not legible enough to attest anything.
    legible: 0.35,
    what: "Internet Archive Italian books — literature, and the register a newspaper never reaches",
    needs: `${CACHE}archive-it`,
    from: "https://archive.org/search?query=mediatype%3Atexts+AND+language%3A%22Italian%22",
    documents: () => {
      const dir = `${CACHE}archive-it`;
      // A locator names the text, not the item: the catalogue page holds no word of the book.
      const named = new Map(
        readFileSync(`${dir}/files.tsv`, "utf8")
          .split("\n")
          .filter(Boolean)
          .map((line) => line.split("\t")),
      );
      const books = readdirSync(dir)
        .filter((file) => file.endsWith(".txt"))
        .map((file) => file.replace(".txt", ""))
        .filter((id) => named.has(id))
        // Percent-encoded: two thirds of Archive filenames contain spaces, and the evidence
        // format spends spaces as separators.
        .map((id) => ({
          locator: `${id}/${encodeURIComponent(named.get(id))}`,
          path: `${dir}/${id}.txt`,
        }));
      return fileDocuments(books, async (path) => readFileSync(path, "utf8"));
    },
  },
];

export const SOURCES = ALL.filter((source) => {
  if (source.needs === undefined || existsSync(source.needs)) return true;
  process.stderr.write(
    `  (skipping ${source.id}: ${source.needs} is not in .cache/raw)\n`,
  );
  return false;
});

/**
 * Italian publishers, for the harvest.
 *
 * Chosen because they publish in Italian rather than because they are large. A harvester reads
 * whatever it fetches and has no idea what language it is in, so an Italian-domiciled site that
 * publishes in English would attest English words against Italian candidates. The last group is
 * literary and cultural, for a register the dailies never reach — which is where the words one
 * family short of the rule tend to live.
 */
export const DOMAINS = [
  // National dailies
  "corriere.it",
  "repubblica.it",
  "lastampa.it",
  "ilmessaggero.it",
  "ilgiornale.it",
  "ilfattoquotidiano.it",
  "avvenire.it",
  "ilsole24ore.com",
  "gazzetta.it",
  // Agencies and broadcasters
  "ansa.it",
  "rainews.it",
  "tg24.sky.it",
  "agi.it",
  "adnkronos.com",
  // Literature, culture and reference, for a register the dailies do not reach
  "ilpost.it",
  "internazionale.it",
  "doppiozero.com",
  "minimaetmoralia.it",
  "illibraio.it",
  "treccani.it",
];

export const HARVEST = existsSync(
  new URL("searched.tsv", import.meta.url).pathname,
)
  ? () => harvestDocuments(new URL("searched.tsv", import.meta.url).pathname)
  : undefined;

/** Carried over from Blinkered's calibration; must be re-measured before anything ships. */
export const COMMON_CUT = 17_000;
