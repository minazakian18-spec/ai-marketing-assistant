# Google Business Profile en Gmail
Maak een Google Cloud-project en OAuth-webclient. Configureer consent screen, appnaam, supportcontact, privacybeleid en domeinverificatie. Vraag afzonderlijk Business Profile API-toegang aan; schakel Account Management, Business Information en benodigde Business Profile review-API's in. Zet Gmail API aan voor Gmail.

Stel GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET server-side in. APP_URL bepaalt de callback, er is geen hardcoded localhostcallback in productie. Registreer exact:
- http://localhost:3000/api/integrations/google_business/callback
- https://mavix.webbo-solutions.nl/api/integrations/google_business/callback
- http://localhost:3000/api/integrations/gmail/callback
- https://mavix.webbo-solutions.nl/api/integrations/gmail/callback

Origins waar Google ze vraagt: http://localhost:3000 en https://mavix.webbo-solutions.nl. Google-login via Supabase gebruikt diens eigen callback, niet bovenstaande.

GBP vraagt business.manage plus openid/email; Gmail vraagt gmail.send plus openid/email, geen mailboxleestoegang. Consent-testgebruikers eerst toevoegen. Externe productiegebruikers kunnen OAuth-verificatie vereisen; GBP-toegang vereist afzonderlijke goedkeuring. Credentials/approval worden niet door de code aangemaakt.

Test: login als OWNER/ADMIN → Account/Integraties → verbinden → consent. GBP blijft selection_required tot je een toegankelijke locatie selecteert. Gmail toont het echte geautoriseerde emailadres. Weiger toestemming, wijzig state en hergebruik callback: geen connected. Test refresh na access-tokenverval en ingetrokken autorisatie. De mailservice kan een RFC2822-base64urlbericht server-side verzenden maar is nog niet aan campagnegoedkeuring gekoppeld; test niet met echte ontvangers zonder expliciete toestemming. Ontkoppelen verwijdert de lokaal bewaarde tokens; trek Google-appautorisatie aanvullend in bij je Google-account (providerrevoke is nog niet aangesloten).

Officiële bronnen:
- https://developers.google.com/my-business/content/implement-oauth
- https://developers.google.com/my-business/content/basic-setup
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send
