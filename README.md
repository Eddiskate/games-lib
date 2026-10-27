# Biblioteka gier

Prosta biblioteka gier: konto użytkownika, skan kodu z pudełka, okładka, platforma i opis.

Skąd biorą się dane. Skan sprawdza każdy kod od razu w kilku katalogach i traktuje UPC-A (12 cyfr, USA) oraz EAN-13 z zerem na początku jako ten sam numer.

- Polska: [x-kom](https://www.x-kom.pl/) (dystrybucja typu Cenega, EAN `590`) oraz Go-UPC.
- Niemcy i reszta Europy: [Go-UPC](https://go-upc.com/) czyta EAN-13 (Niemcy `400–440`, Francja, Wielka Brytania i inne prefiksy). Bez klucza bierzemy publiczną stronę produktu. `GO_UPC_API_KEY` jest opcjonalny.
- USA: Go-UPC i [UPC Item DB](https://www.upcitemdb.com/). Amerykańskie API często nie zna europejskich EAN-ów, więc przy pustej odpowiedzi czytamy stronę produktu — tam są też niemieckie wydania.
- [BarcodeFinder](https://www.barcodefinder.info/) to dodatkowe źródło nazwy i zdjęcia. Bez klucza.
- [RAWG](https://rawg.io/apidocs) po nazwie dociąga okładkę, premierę, gatunki i opis. Darmowy klucz: `RAWG_API_KEY` w `server/.env`. Platforma zostaje ta z pudełka, jeśli kod ją podał.
- [ScanDex](https://scandex.gamery.app/) rozpoznaje kod jako konkretną grę i platformę. Opcjonalny token: `SCANDEX_TOKEN`.

Bez klucza RAWG skan zapisze nazwę i zdjęcie z kodu kreskowego. Platforma jest wtedy brana z nazwy (PS5, Switch, Xbox i podobne), jeśli da się ją rozpoznać.

## Uruchomienie

MongoDB:

```bash
docker compose up -d
```

Albo własna instancja na `mongodb://127.0.0.1:27017/games-lib`.

```bash
cd server && npm install && npm start
cd client && npm install && npm start
```

Aplikacja: http://localhost:4200  
API: http://localhost:3000

Aparat działa na localhost. Po pierwszym skanie wybierasz właściwą grę i dodajesz ją do swojej półki.

## Docker / EasyPanel

W katalogu projektu jest `Dockerfile` (jeden kontener: UI + API).

**EasyPanel → App → Dockerfile**

- Port: `3000`
- Build context: root repo

**Environment**

| Variable | Opis |
|----------|------|
| `MONGODB_URI` | adres MongoDB, np. usługa Mongo w EasyPanel |
| `JWT_SECRET` | tajny klucz JWT (długi, losowy) |
| `RAWG_API_KEY` | opcjonalnie: okładka, platformy, opis z RAWG |
| `SCANDEX_TOKEN` | opcjonalnie: kod z pudełka od razu jako gra |
| `GO_UPC_API_KEY` | opcjonalnie: szersza baza kodów EAN/UPC, w tym europejskie wydania. Darmowy klucz: 150 zapytań miesięcznie po akceptacji na go-upc.com |
| `PRICECHARTING_TOKEN` | opcjonalnie: przybliżona cena używanej gry, w USD. Płatny token z PriceCharting. Przy skanie rozpoznaje też tytuł i konsolę |
| `PORT` | domyślnie `3000` |

MongoDB to osobna usługa. Baza nie siedzi w kontenerze aplikacji, więc volume dla tego obrazu nie jest potrzebny.
