-- Profit Share events sync to the calendar and do not track attendance.
ALTER TYPE public.checkin_type ADD VALUE IF NOT EXISTS 'none';
