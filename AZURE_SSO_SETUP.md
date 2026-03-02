# Azure SSO Setup — FLUXS Arbeitszeiterfassung

Diese Anleitung beschreibt Schritt für Schritt, wie du eine Azure App Registration
erstellst, damit Microsoft SSO in der FLUXS Zeit-App funktioniert.

---

## Voraussetzungen

- Ein Microsoft Azure Konto mit Zugriff auf das Azure Portal
- Admin-Rechte im Azure AD Tenant der FLUXS GmbH
  (oder ein Global Admin muss die App freigeben)

---

## Schritt 1: Azure Portal öffnen

1. Gehe zu [portal.azure.com](https://portal.azure.com)
2. Melde dich mit einem Admin-Konto der FLUXS GmbH an

---

## Schritt 2: App Registration erstellen

1. Suche in der oberen Suchleiste nach **"App registrations"**
   (oder **"App-Registrierungen"** auf Deutsch)
2. Klicke auf **"+ New registration"** / **"+ Neue Registrierung"**
3. Fülle das Formular aus:

| Feld | Wert |
|------|------|
| **Name** | `FLUXS Arbeitszeiterfassung` |
| **Supported account types** | "Accounts in this organizational directory only (FLUXS GmbH only — Single tenant)" |
| **Redirect URI** | Platform: **Single-page application (SPA)** |
| | URI: `https://deine-staging-url.s3.amazonaws.com/index.html` |

4. Klicke auf **"Register"** / **"Registrieren"**

---

## Schritt 3: Client ID kopieren

Nach der Registrierung siehst du die Übersichtsseite der App.

1. Kopiere die **Application (client) ID** — das ist eine UUID wie:
   `a1b2c3d4-e5f6-7890-abcd-ef1234567890`
2. Kopiere auch die **Directory (tenant) ID** — wird für Single-Tenant benötigt

---

## Schritt 4: Redirect URIs konfigurieren

1. Gehe links zu **"Authentication"** / **"Authentifizierung"**
2. Unter **"Single-page application"** füge alle Redirect URIs hinzu:

```
https://deine-staging-url.s3.amazonaws.com/index.html
https://deine-live-url.s3.amazonaws.com/index.html
http://localhost:8000/index.html
http://localhost:3000/index.html
```

3. Unter **"Implicit grant and hybrid flows"**:
   - ID tokens (für MSAL.js SPA)
   - Access tokens (nicht nötig)

4. Klicke **"Save"** / **"Speichern"**

---

## Schritt 5: API Permissions prüfen

1. Gehe links zu **"API permissions"** / **"API-Berechtigungen"**
2. Standardmäßig sollte `User.Read` (Microsoft Graph) vorhanden sein
3. Falls nicht: **"+ Add a permission"** → **Microsoft Graph** →
   **Delegated permissions** → `User.Read` und `email`
4. Klicke auf **"Grant admin consent for FLUXS GmbH"** (Admin-Zustimmung)

---

## Schritt 6: Client ID in der App eintragen

Öffne die Datei `core/auth.js` und ersetze den Platzhalter:

```javascript
// VORHER:
const MSAL_CLIENT_ID = 'YOUR_AZURE_CLIENT_ID';
const MSAL_TENANT = 'common';

// NACHHER (Beispiel):
const MSAL_CLIENT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const MSAL_TENANT = 'deine-tenant-id-hier';
```

Für **Single Tenant** (empfohlen): Setze `MSAL_TENANT` auf deine
Directory (tenant) ID.

Für **Multi Tenant**: Belasse `MSAL_TENANT` auf `'common'`.

---

## Schritt 7: Testen

1. Deploye die App (Staging zuerst)
2. Öffne die Login-Seite
3. Klicke auf **"mit microsoft anmelden"**
4. Es sollte ein Microsoft-Popup erscheinen
5. Melde dich mit deinem FLUXS Microsoft-Konto an
6. Nach erfolgreicher Anmeldung wirst du zum Dashboard weitergeleitet

---

## Fehlerbehebung

### AADSTS700016 — Application not found
- Die Client ID in `auth.js` stimmt nicht mit der App Registration überein
- Oder die App wurde in einem anderen Tenant erstellt

### AADSTS50011 — Reply URL mismatch
- Die aktuelle URL der App ist nicht in den Redirect URIs eingetragen
- Füge die exakte URL (mit Protokoll) unter Authentication hinzu

### AADSTS65001 — Consent required
- Ein Admin muss unter API Permissions die Admin-Zustimmung erteilen
- Klicke auf "Grant admin consent for FLUXS GmbH"

### Popup wird blockiert
- Browser-Popup-Blocker deaktivieren für die App-URL
- Oder in den MSAL-Config `loginRedirect` statt `loginPopup` verwenden

### SSO funktioniert auf Staging, aber nicht auf Live
- Prüfe, ob die Live-URL auch als Redirect URI eingetragen ist
- Die URL muss exakt übereinstimmen (inkl. https vs. http)

---

## Sicherheitshinweise

- Speichere die Client ID **nie** in öffentlichen Repos mit echten Werten
- Nutze Environment-Variablen oder einen Build-Prozess für Produktiv-Deploys
- Überprüfe regelmäßig die API Permissions der App
- Entferne nicht mehr benötigte Redirect URIs

---

## Zusammenfassung der Konfigurationswerte

| Wert | Wo eintragen |
|------|-------------|
| Application (client) ID | `core/auth.js` → `MSAL_CLIENT_ID` |
| Directory (tenant) ID | `core/auth.js` → `MSAL_TENANT` |
| Redirect URIs | Azure Portal → Authentication |
| API Permissions | `User.Read`, `email` (Microsoft Graph) |
