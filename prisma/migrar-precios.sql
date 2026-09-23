-- ============================================================================
--  Precios: de la actividad al trabajador
--
--  Antes el precio por metro vivia en actividades.valor_m2. Ahora vive en
--  trabajador_actividad, porque lo que se paga depende de quien ejecuta.
--
--  El schema nuevo hace dos cosas de golpe: crea la tabla de precios y elimina
--  la columna vieja. Por eso la copia va en dos pasos, uno antes y otro
--  despues, con un respaldo en medio.
--
--  Todo esto es OPCIONAL. Si los precios que habia en las actividades no
--  servian, salta el script y llena cada ficha desde el formulario de
--  trabajadores. Las jornadas ya registradas no se tocan en ningun caso: cada
--  una conserva copiado el precio con el que se guardo.
-- ============================================================================

-- --- PASO 1: antes de aplicar el schema nuevo -------------------------------
-- Guarda los precios que hoy tienen las actividades, porque el push siguiente
-- elimina esa columna.

CREATE TABLE IF NOT EXISTS respaldo_precios_actividad AS
SELECT id_actividad, valor_m2
FROM actividades
WHERE valor_m2 IS NOT NULL;

-- --- Aplicar el schema ------------------------------------------------------
--   npx prisma generate
--   npx prisma db push --accept-data-loss     <- crea trabajador_actividad y
--                                                elimina actividades.valor_m2
--   npm run db:constraints

-- --- PASO 2: despues de aplicar el schema -----------------------------------
-- Copia el precio de cada actividad a TODOS los trabajadores, como punto de
-- partida. Luego se ajustan a mano en su ficha los que cobran distinto.

INSERT INTO trabajador_actividad (id_trabajador, id_actividad, valor_m2)
SELECT t.id_trabajador, r.id_actividad, r.valor_m2
FROM trabajadores t
CROSS JOIN respaldo_precios_actividad r
ON CONFLICT (id_trabajador, id_actividad) DO NOTHING;

DROP TABLE respaldo_precios_actividad;
