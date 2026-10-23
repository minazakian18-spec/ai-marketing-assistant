// Published and sent mean real provider actions only when Mavix recorded the
// provider's confirmation (post.instagram, campaign.delivery). Older records
// from the demo period carry no confirmation and keep saying so.
export const publishedLabel = (confirmed: boolean) => (confirmed ? "Gepubliceerd" : "Demo gepubliceerd");
export const sentLabel = (confirmed: boolean) => (confirmed ? "Verzonden" : "Demo verzonden");
