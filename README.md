# Biblioteka gier

Prosta biblioteka gier: konto użytkownika, skan kodu z pudełka, okładka, platforma i opis.

Skąd biorą się dane:

- [BarcodeFinder](https://www.barcodefinder.info/) czyta kod EAN/UPC z pudełka i zwraca nazwę oraz zdjęcie. Bez klucza.
- [RAWG](https://rawg.io/apidocs) po tej nazwie dociąga okładkę, platformy, premierę, gatunki i opis. Darmowy klucz: `RAWG_API_KEY` w `server/.env`.
- [ScanDex](https://scandex.gamery.app/) rozpoznaje kod jako konkretną grę i platformę pudełka. Opcjonalny token: `SCANDEX_TOKEN`.

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
| `PORT` | domyślnie `3000` |

MongoDB to osobna usługa. Baza nie siedzi w kontenerze aplikacji, więc volume dla tego obrazu nie jest potrzebny.
