# Stripe en notificaties instellen
Maak een Stripe-testaccount/omgeving. Maak 3 producten (Starter/Growth/Autopilot), elk met een maand- en jaarprijs in EUR. Zet de 6 Price IDs en STRIPE_SECRET_KEY in de serveromgeving. Prijzen komen uitsluitend uit deze allowlist.

Webhook endpoint: https://mavix.webbo-solutions.nl/api/billing/webhook. Gebruik lokaal Stripe CLI-forwarding naar http://localhost:3000/api/billing/webhook; neem de bijbehorende STRIPE_WEBHOOK_SECRET. Abonneer op customer.subscription.created/updated/deleted. Checkoutredirect is nooit betalingsbewijs. Configureer Customer Portal voor abonnementwijzigingen, opzeggen, betaalmethoden, billinggegevens/facturen; controleer welke wijzigingen Stripe voor je prijsmodel toestaat. Planwijzigingen worden uit de echte subscription/price gelezen.

Huidige Checkout: alleen kaart, subscription mode, billingadres en tax ID. NL iDEAL is geen rechtstreeks herbruikbaar recurring-betaalmiddel: een iDEAL→SEPA-mandaatflow vergt extra implementatie. PayPal recurring bestaat bij Stripe voor onder meer NL maar kan approval vereisen; is hier nog NIET ingeschakeld. Toon beide niet als beschikbaar.

Test met Stripe-testkaarten: succesvolle en geweigerde betaling, past_due/canceled via Stripe-testtools, portalwijzigingen, echte factuurmetadata, opnieuw verstuurde webhook en foutieve signature. Webhooks zijn nog niet live getest; concurrency/deduplicatie van bijkomende side effects vraagt verdere hardening vóór productie.

Resend: verifieer verzenddomein, vul EMAIL_API_KEY en EMAIL_FROM. Auth-reset/confirmmails lopen via Supabase SMTP, niet deze adapter. Teamuitnodigingen gebruiken de Resend-adapter. Een geaccepteerd API-verzoek betekent nog geen bezorgde email.

Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM. Ontvangers moeten internationaal E.164 zijn (+316...). SMS-provideradapter bestaat, maar verificatie, eventrouter en delivery queue zijn nog niet gereed. Er worden geen automatische SMS'en geclaimd.

Bronnen:
- https://docs.stripe.com/payments/paypal
- https://docs.stripe.com/payments/ideal/set-up-payment
- https://www.twilio.com/docs/messaging/api/message-resource
