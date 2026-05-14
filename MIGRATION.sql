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
('Dánsko',    'dk', 'Česko',     'cz', '2026-05-15 20:20:00+02', 'upcoming', 2925540, 'B'),
('Slovensko', 'sk', 'Norsko',    'no', '2026-05-16 12:20:00+02', 'upcoming', 2925541, 'B'),
('Kanada',    'ca', 'Itálie',    'it', '2026-05-16 16:20:00+02', 'upcoming', 2925542, 'B'),
('Slovinsko', 'si', 'Česko',     'cz', '2026-05-16 20:20:00+02', 'upcoming', 2925543, 'B'),
('Itálie',    'it', 'Slovensko', 'sk', '2026-05-17 12:20:00+02', 'upcoming', 2925544, 'B'),
('Švédsko',   'se', 'Dánsko',    'dk', '2026-05-17 16:20:00+02', 'upcoming', 2925545, 'B'),
('Norsko',    'no', 'Slovinsko', 'si', '2026-05-17 20:20:00+02', 'upcoming', 2925546, 'B'),
('Kanada',    'ca', 'Dánsko',    'dk', '2026-05-18 16:20:00+02', 'upcoming', 2925547, 'B'),
('Česko',     'cz', 'Švédsko',   'se', '2026-05-18 20:20:00+02', 'upcoming', 2925548, 'B'),
('Itálie',    'it', 'Norsko',    'no', '2026-05-19 16:20:00+02', 'upcoming', 2925549, 'B'),
('Slovinsko', 'si', 'Slovensko', 'sk', '2026-05-19 20:20:00+02', 'upcoming', 2925550, 'B'),
('Česko',     'cz', 'Itálie',    'it', '2026-05-20 16:20:00+02', 'upcoming', 2925551, 'B'),
('Švédsko',   'se', 'Slovinsko', 'si', '2026-05-20 20:20:00+02', 'upcoming', 2925552, 'B'),
('Norsko',    'no', 'Kanada',    'ca', '2026-05-21 16:20:00+02', 'upcoming', 2925553, 'B'),
('Dánsko',    'dk', 'Slovensko', 'sk', '2026-05-21 20:20:00+02', 'upcoming', 2925554, 'B'),
('Kanada',    'ca', 'Slovinsko', 'si', '2026-05-22 16:20:00+02', 'upcoming', 2925555, 'B'),
('Itálie',    'it', 'Švédsko',   'se', '2026-05-22 20:20:00+02', 'upcoming', 2925556, 'B'),
('Dánsko',    'dk', 'Slovinsko', 'si', '2026-05-23 12:20:00+02', 'upcoming', 2925557, 'B'),
('Slovensko', 'sk', 'Česko',     'cz', '2026-05-23 16:20:00+02', 'upcoming', 2925558, 'B'),
('Švédsko',   'se', 'Norsko',    'no', '2026-05-23 20:20:00+02', 'upcoming', 2925559, 'B'),
('Dánsko',    'dk', 'Itálie',    'it', '2026-05-24 16:20:00+02', 'upcoming', 2925560, 'B'),
('Kanada',    'ca', 'Slovensko', 'sk', '2026-05-24 20:20:00+02', 'upcoming', 2925561, 'B'),
('Česko',     'cz', 'Norsko',    'no', '2026-05-25 16:20:00+02', 'upcoming', 2925562, 'B'),
('Slovinsko', 'si', 'Itálie',    'it', '2026-05-25 20:20:00+02', 'upcoming', 2925563, 'B'),
('Norsko',    'no', 'Dánsko',    'dk', '2026-05-26 12:20:00+02', 'upcoming', 2925564, 'B'),
('Česko',     'cz', 'Kanada',    'ca', '2026-05-26 16:20:00+02', 'upcoming', 2925566, 'B'),
('Slovensko', 'sk', 'Švédsko',   'se', '2026-05-26 20:20:00+02', 'upcoming', 2925565, 'B');

-- 8) Insert všech 28 zápasů Skupiny A MS 2026 (Curych)
INSERT INTO matches (home_team, home_code, away_team, away_code, match_date, status, hokej_cz_id, "group") VALUES
('Finsko',          'fi', 'Německo',          'de', '2026-05-15 16:20:00+02', 'upcoming', 2928197, 'A'),
('USA',             'us', 'Švýcarsko',        'ch', '2026-05-15 20:20:00+02', 'upcoming', 2928198, 'A'),
('Velká Británie',  'gb', 'Rakousko',         'at', '2026-05-16 12:20:00+02', 'upcoming', 2928199, 'A'),
('Maďarsko',        'hu', 'Finsko',           'fi', '2026-05-16 16:20:00+02', 'upcoming', 2928200, 'A'),
('Švýcarsko',       'ch', 'Lotyšsko',         'lv', '2026-05-16 20:20:00+02', 'upcoming', 2928201, 'A'),
('Velká Británie',  'gb', 'USA',              'us', '2026-05-17 12:20:00+02', 'upcoming', 2928202, 'A'),
('Rakousko',        'at', 'Maďarsko',         'hu', '2026-05-17 16:20:00+02', 'upcoming', 2928203, 'A'),
('Německo',         'de', 'Lotyšsko',         'lv', '2026-05-17 20:20:00+02', 'upcoming', 2928204, 'A'),
('Finsko',          'fi', 'USA',              'us', '2026-05-18 16:20:00+02', 'upcoming', 2928205, 'A'),
('Německo',         'de', 'Švýcarsko',        'ch', '2026-05-18 20:20:00+02', 'upcoming', 2928206, 'A'),
('Lotyšsko',        'lv', 'Rakousko',         'at', '2026-05-19 16:20:00+02', 'upcoming', 2928207, 'A'),
('Maďarsko',        'hu', 'Velká Británie',   'gb', '2026-05-19 20:20:00+02', 'upcoming', 2928208, 'A'),
('Rakousko',        'at', 'Švýcarsko',        'ch', '2026-05-20 16:20:00+02', 'upcoming', 2928209, 'A'),
('USA',             'us', 'Německo',          'de', '2026-05-20 20:20:00+02', 'upcoming', 2928210, 'A'),
('Lotyšsko',        'lv', 'Finsko',           'fi', '2026-05-21 16:20:00+02', 'upcoming', 2928211, 'A'),
('Švýcarsko',       'ch', 'Velká Británie',   'gb', '2026-05-21 20:20:00+02', 'upcoming', 2928212, 'A'),
('Německo',         'de', 'Maďarsko',         'hu', '2026-05-22 16:20:00+02', 'upcoming', 2928213, 'A'),
('Finsko',          'fi', 'Velká Británie',   'gb', '2026-05-22 20:20:00+02', 'upcoming', 2928214, 'A'),
('Lotyšsko',        'lv', 'USA',              'us', '2026-05-23 12:20:00+02', 'upcoming', 2928215, 'A'),
('Švýcarsko',       'ch', 'Maďarsko',         'hu', '2026-05-23 16:20:00+02', 'upcoming', 2928216, 'A'),
('Rakousko',        'at', 'Německo',          'de', '2026-05-23 20:20:00+02', 'upcoming', 2928217, 'A'),
('Velká Británie',  'gb', 'Lotyšsko',         'lv', '2026-05-24 16:20:00+02', 'upcoming', 2928218, 'A'),
('Finsko',          'fi', 'Rakousko',         'at', '2026-05-24 20:20:00+02', 'upcoming', 2928219, 'A'),
('USA',             'us', 'Maďarsko',         'hu', '2026-05-25 16:20:00+02', 'upcoming', 2928220, 'A'),
('Německo',         'de', 'Velká Británie',   'gb', '2026-05-25 20:20:00+02', 'upcoming', 2928221, 'A'),
('Maďarsko',        'hu', 'Lotyšsko',         'lv', '2026-05-26 12:20:00+02', 'upcoming', 2928222, 'A'),
('USA',             'us', 'Rakousko',         'at', '2026-05-26 16:20:00+02', 'upcoming', 2928223, 'A'),
('Švýcarsko',       'ch', 'Finsko',           'fi', '2026-05-26 20:20:00+02', 'upcoming', 2928224, 'A');
