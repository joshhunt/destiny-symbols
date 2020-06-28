import React from "react";
import opentype from "opentype.js";

import "./styles.css";

const FONTS = [
  "/fonts/Destiny_Keys.otf",
  "/fonts/Destiny_Symbols_360.ttf",
  "/fonts/Destiny_Symbols_PC.otf",
  "/fonts/Destiny_Symbols_PS4.otf",
  "/fonts/Destiny_Symbols_Stadia.otf",
  "/fonts/Destiny_Symbols_Steam.otf",
  "/fonts/Destiny_Symbols_Xbox_ONE.otf"
];

const LANGUAGE = "en";
const API_KEY = "ff9e8e42a11b43d5b339cd8606c81dca";

const iconFinder = /(\[[^\]]+\]|[\uE000-\uF8FF])/g;
const glyphFinder = /([\uE000-\uF8FF])/g;

export default function App() {
  const [glyphs, setGlyphs] = React.useState([]);
  const [definitions, setDefinitions] = React.useState();
  const [chDefinitions, setChDefinitions] = React.useState();
  const [overrides, setOverrides] = React.useState({});

  React.useEffect(() => {
    async function loadFonts() {
      var allGlyphs = [];

      for (let fontUrl of FONTS) {
        console.log("Loading", fontUrl);
        const font = await opentype.load(fontUrl);

        for (let index in font.glyphs.glyphs) {
          // console.log(`  #${index} `)
          const glyph = font.glyphs.glyphs[index];
          const found = allGlyphs.find(g => g.glyph.name === glyph.name);

          if (!found) {
            allGlyphs.push({ glyph, fontUrl });
          }
        }
      }

      setGlyphs(allGlyphs);
    }

    async function loadDefs() {
      const manifest = await (await fetch(
        "https://www.bungie.net/Platform/Destiny2/Manifest/",
        {
          headers: { "x-api-key": API_KEY }
        }
      )).json();

      const objectivesUrl =
        manifest.Response.jsonWorldComponentContentPaths[LANGUAGE]
          .DestinyObjectiveDefinition;

      const defs = await (await fetch(
        `https://www.bungie.net${objectivesUrl}`
      )).json();

      setDefinitions(defs);

      const chObjectivesUrl =
        manifest.Response.jsonWorldComponentContentPaths["zh-cht"]
          .DestinyObjectiveDefinition;

      const chDefs = await (await fetch(
        `https://www.bungie.net${chObjectivesUrl}`
      )).json();

      setChDefinitions(chDefs);
    }

    loadFonts();
    loadDefs();
  }, []);

  const data = React.useMemo(() => {
    if (!definitions || !chDefinitions) {
      return [];
    }

    const acc = [];

    Object.values(definitions).forEach(function(objective) {
      const match =
        objective.progressDescription &&
        objective.progressDescription.match(iconFinder);

      const substring = match && match[0];

      if (substring) {
        const found = acc.find(v => v.substring === substring);

        if (found) {
          return;
        }

        const obj = { substring, objective };

        const chDef = chDefinitions[objective.hash];
        const chMatch =
          chDef.progressDescription &&
          chDef.progressDescription.match(glyphFinder);

        const chSymbol = chMatch && chMatch[0];

        if (chSymbol) {
          obj.symbol = chSymbol;
        }

        if (overrides[substring]) {
          obj.overrideSymbol = overrides[substring];
        }

        acc.push(obj);
      }
    });

    return acc;
  }, [definitions, chDefinitions, overrides]);

  const codes = React.useMemo(() => {
    const finalData = data
      .map(d => ({
        substring: d.substring,
        unicode: d.overrideSymbol || d.symbol,
        objectiveHash: d.objective.hash
      }))
      .filter(v => v.unicode);

    const rows = finalData
      .map(
        icon =>
          `("${icon.substring}", "${icon.unicode}", ${icon.objectiveHash}L)`
      )
      .join(",\n");

    const csharp = `var icons = new []
  {
  ${rows}
  };`;

    return {
      csharp,
      json: JSON.stringify(finalData, null, 2)
    };
  }, [data]);

  React.useEffect(() => {
    if (Object.keys(overrides).length) {
      localStorage.setItem("overrides", JSON.stringify(overrides));
    }
  }, [overrides]);

  React.useEffect(() => {
    var json = localStorage.getItem("overrides");

    if (json) {
      try {
        setOverrides(JSON.parse(json));
      } catch (error) {}
    }
  }, []);

  const overrideGlyph = (glyph, override) => {
    setOverrides(v => ({
      ...v,
      [glyph.substring]: override
    }));
  };

  return (
    <div className="App">
      <table>
        <thead>
          <tr>
            <td>substring</td>
            <td>ch-zht symbol</td>
            <td>override</td>
            <td>objective hash</td>
            <td>progress description</td>
          </tr>
        </thead>

        <tbody>
          {data.map(row => (
            <tr>
              <td>{row.substring}</td>
              <td>{row.symbol}</td>
              <td>
                {row.overrideSymbol ? (
                  <span onClick={() => overrideGlyph(row, undefined)}>
                    {row.overrideSymbol}
                  </span>
                ) : (
                  <SymbolSearch
                    glyphs={glyphs}
                    onClick={selected =>
                      overrideGlyph(row, String.fromCharCode(selected.unicode))
                    }
                  />
                )}
              </td>
              <td>{row.objective.hash}</td>
              <td>{row.objective.progressDescription}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>All symbols</h2>

      <div className="list">
        {glyphs.map(({ glyph, fontUrl }) => (
          <div className="symbol">
            <div className="symbol-glyph glyph">
              {String.fromCharCode(glyph.unicode)}
            </div>

            <div className="symbol-name">{glyph.name}</div>

            <div className="symbol-url">
              {fontUrl
                .replace("/fonts/", "")
                .replace(".otf", "")
                .replace(".ttf", "")}
            </div>
          </div>
        ))}
      </div>

      <h2>Code</h2>

      <h3>C#</h3>
      <pre>{codes.csharp}</pre>

      <h3>JSON</h3>
      <pre>{codes.json}</pre>
    </div>
  );
}

function SymbolSearch({ glyphs, onClick }) {
  const [search, setSearch] = React.useState("");

  const results = React.useMemo(() => {
    if (!glyphs || search.length < 1) {
      return [];
    }

    return glyphs.filter(g =>
      g.glyph.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, glyphs]);

  const onType = ev => {
    setSearch(ev.target.value);
  };

  return (
    <div className="search">
      <input className="textbox" type="text" value={search} onChange={onType} />

      <table class="results">
        <tbody>
          {results.map(({ glyph }) => {
            return (
              <tr className="result" onClick={() => onClick(glyph)}>
                <td className="glyph">{String.fromCharCode(glyph.unicode)}</td>
                <td>{glyph.name}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
