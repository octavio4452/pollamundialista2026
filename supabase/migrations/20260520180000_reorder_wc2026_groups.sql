-- Reasignar grupos del Mundial 2026 según sorteo oficial (5 dic 2025)
UPDATE public.teams SET group_name = 'A' WHERE code IN ('MEX','KOR','RSA','DEN');
UPDATE public.teams SET group_name = 'B' WHERE code IN ('CAN','SUI','QAT','ITA');
UPDATE public.teams SET group_name = 'C' WHERE code IN ('BRA','MAR','SCO','NGA');
UPDATE public.teams SET group_name = 'D' WHERE code IN ('USA','AUS','PAR','TUR');
UPDATE public.teams SET group_name = 'E' WHERE code IN ('GER','ECU','CIV','CUW');
UPDATE public.teams SET group_name = 'F' WHERE code IN ('NED','JPN','TUN','POL');
UPDATE public.teams SET group_name = 'G' WHERE code IN ('BEL','IRN','EGY','NZL');
UPDATE public.teams SET group_name = 'H' WHERE code IN ('ESP','URU','KSA','CPV');
UPDATE public.teams SET group_name = 'I' WHERE code IN ('FRA','SEN','NOR','HUN');
UPDATE public.teams SET group_name = 'J' WHERE code IN ('ARG','AUT','ALG','JOR');
UPDATE public.teams SET group_name = 'K' WHERE code IN ('POR','COL','UZB','JAM');
UPDATE public.teams SET group_name = 'L' WHERE code IN ('ENG','CRO','PAN','GHA');
