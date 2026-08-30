-- Backfill: every inquiry accepted through the pre-multi-hospital flow is the chosen one.
-- The old respondToInquiry ACCEPTED path allowed at most one ACCEPTED inquiry per case.
UPDATE "HospitalInquiry" SET "isChosen" = true WHERE "status" = 'ACCEPTED' AND "isChosen" = false;
