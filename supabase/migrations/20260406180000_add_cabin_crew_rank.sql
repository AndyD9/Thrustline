-- Add cabin_crew to the crew_rank enum
ALTER TYPE crew_rank ADD VALUE IF NOT EXISTS 'cabin_crew';
