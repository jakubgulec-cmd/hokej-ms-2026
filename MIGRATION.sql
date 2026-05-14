-- ============================================================
-- MIGRACE: z "Česko vs opponent" na obecné "home vs away"
-- Spusť v Supabase SQL Editor jako jeden query
-- ============================================================

-- 1) Smazat všechna stará data
DELETE FROM predictions;
DELETE FROM matches;

-- 2) Přidat nové sloupce do matches
ALTER TABLE matches
  ADD COLUMN home_team TEXT,
  ADD COLUMN home_code TEXT,
  ADD COLUMN away_team TEXT,
  ADD COLUMN away_code TEXT,
  ADD COLUMN home_goals INT,
  ADD COLUMN away_goals INT,
  ADD COLUMN live_home_goals INT,
  ADD COLUMN live_away_goals INT,
  ADD COLUMN "group" TEXT;

-- 3) Přidat nové sloupce do predictions
ALTER TABLE predictions
  ADD COLUMN home_goals_pred INT,
  ADD COLUMN away_goals_pred INT;

-- 4) Smazat staré sloupce (až po vytvoření nových)
ALTER TABLE matches
  DROP COLUMN opponent,
  DROP COLUMN czech_goals,
  DROP COLUMN opponent_goals,
  DROP COLUMN live_czech_goals,
  DROP COLUMN live_opponent_goals;

ALTER TABLE predictions
  DROP COLUMN czech_goals,
  DROP COLUMN opponent_goals;

-- 5) Přejmenovat aby to bylo čistější (drop _pred suffix)
ALTER TABLE predictions RENAME COLUMN home_goals_pred TO home_goals;
ALTER TABLE predictions RENAME COLUMN away_goals_pred TO away_goals;

-- 6) Nastavit NOT NULL constraints
ALTER TABLE matches ALTER COLUMN home_team SET NOT NULL;
ALTER TABLE matches ALTER COLUMN home_code SET NOT NULL;
ALTER TABLE matches ALTER COLUMN away_team SET NOT NULL;
ALTER TABLE matches ALTER COLUMN away_code SET NOT NULL;

ALTER TABLE predictions ALTER COLUMN home_goals SET NOT NULL;
ALTER TABLE predictions ALTER COLUMN away_goals SET NOT NULL;

-- 7) Insert všech 28 zápasů Skupiny B MS 2026 (kde hraje Česko)
INSERT INTO matches (home_team, home_code, away_team, away_code, match_date, status, hokej_cz_id, "group") VALUES
('Švédsko',   'se', 'Kanada',    'ca', '2026-05-15 16:20:00+02', 'upcoming', 2925539, 'B'),
('Česko',     'cz', 'Dánsko',    'dk', '2026-05-15 20:20:00+02', 'upcoming', 2925540, 'B'),
('Slovensko', 'sk', 'Norsko',    'no', '2026-05-16 12:20:00+02', 'upcoming', 2925541, 'B'),
('Itálie',    'it', 'Kanada',    'ca', '2026-05-16 16:20:00+02', 'upcoming', 2925542, 'B'),
('Slovinsko', 'si', 'Česko',     'cz', '2026-05-16 20:20:00+02', 'upcoming', 2925543, 'B'),
('Itálie',    'it', 'Slovensko', 'sk', '2026-05-17 12:20:00+02', 'upcoming', 2925544, 'B'),
('Dánsko',    'dk', 'Švédsko',   'se', '2026-05-17 16:20:00+02', 'upcoming', 2925545, 'B'),
('Slovinsko', 'si', 'Norsko',    'no', '2026-05-17 20:20:00+02', 'upcoming', 2925546, 'B'),
('Kanada',    'ca', 'Dánsko',    'dk', '2026-05-18 16:20:00+02', 'upcoming', 2925547, 'B'),
('Česko',     'cz', 'Švédsko',   'se', '2026-05-18 20:20:00+02', 'upcoming', 2925548, 'B'),
('Itálie',    'it', 'Norsko',    'no', '2026-05-19 16:20:00+02', 'upcoming', 2925549, 'B'),
('Slovinsko', 'si', 'Slovensko', 'sk', '2026-05-19 20:20:00+02', 'upcoming', 2925550, 'B'),
('Česko',     'cz', 'Itálie',    'it', '2026-05-20 16:20:00+02', 'upcoming', 2925551, 'B'),
('Slovinsko', 'si', 'Švédsko',   'se', '2026-05-20 20:20:00+02', 'upcoming', 2925552, 'B'),
('Norsko',    'no', 'Kanada',    'ca', '2026-05-21 16:20:00+02', 'upcoming', 2925553, 'B'),
('Dánsko',    'dk', 'Slovensko', 'sk', '2026-05-21 20:20:00+02', 'upcoming', 2925554, 'B'),
('Kanada',    'ca', 'Slovinsko', 'si', '2026-05-22 16:20:00+02', 'upcoming', 2925555, 'B'),
('Itálie',    'it', 'Švédsko',   'se', '2026-05-22 20:20:00+02', 'upcoming', 2925556, 'B'),
('Dánsko',    'dk', 'Slovinsko', 'si', '2026-05-23 12:20:00+02', 'upcoming', 2925557, 'B'),
('Česko',     'cz', 'Slovensko', 'sk', '2026-05-23 16:20:00+02', 'upcoming', 2925558, 'B'),
('Švédsko',   'se', 'Norsko',    'no', '2026-05-23 20:20:00+02', 'upcoming', 2925559, 'B'),
('Dánsko',    'dk', 'Itálie',    'it', '2026-05-24 16:20:00+02', 'upcoming', 2925560, 'B'),
('Kanada',    'ca', 'Slovensko', 'sk', '2026-05-24 20:20:00+02', 'upcoming', 2925561, 'B'),
('Česko',     'cz', 'Norsko',    'no', '2026-05-25 16:20:00+02', 'upcoming', 2925562, 'B'),
('Slovinsko', 'si', 'Itálie',    'it', '2026-05-25 20:20:00+02', 'upcoming', 2925563, 'B'),
('Norsko',    'no', 'Dánsko',    'dk', '2026-05-26 12:20:00+02', 'upcoming', 2925564, 'B'),
('Česko',     'cz', 'Kanada',    'ca', '2026-05-26 16:20:00+02', 'upcoming', 2925566, 'B'),
('Švédsko',   'se', 'Slovensko', 'sk', '2026-05-26 20:20:00+02', 'upcoming', 2925565, 'B');
