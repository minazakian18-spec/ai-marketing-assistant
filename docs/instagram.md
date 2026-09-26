# Instagram: nog niet vrijgegeven
De huidige Connect-actie meldt expliciet dat implementatievalidatie/configuratie ontbreekt; geen fake connected-state.

Beoogd: Meta Instagram API with Instagram Login voor professionele business/creator-accounts, geen wachtwoord/scraping en geen oude Basic Display API. Maak een Meta developer app, voeg Instagram-product toe en configureer Instagram Login. Nodig development-testers uit. Productie vereist passende app review/advanced access en privacy/deletion-instellingen volgens Meta.

Reserveer callback https://mavix.webbo-solutions.nl/api/integrations/instagram/callback en de lokale equivalent indien Meta dat voor de gekozen setup toestaat. META_CLIENT_ID, META_CLIENT_SECRET, META_GRAPH_VERSION en OAUTH_ENCRYPTION_KEY blijven server-only. Scopevoornemen: instagram_business_basic en instagram_business_content_publish; geen messaging/commentrechten zonder functie. Deze envwaarden activeren de ontbrekende adapter nog niet.

Nog te implementeren/testen: code exchange, langlevende tokens/refresh, accountvalidatie, echte healthcheck, container-publicatie/status en disconnect/revoke. Geen productieclaim tot development-testaccount en app review zijn gevalideerd.

Officieel: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/
Meta-collectie: https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login
