-- Store Google Maps URI when a Places suggestion is chosen (null for free-text locations).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS location_maps_url text;

COMMENT ON COLUMN public.events.location_maps_url IS
  'Google Maps URI from Places when location was chosen via autocomplete; null for free-text locations';
