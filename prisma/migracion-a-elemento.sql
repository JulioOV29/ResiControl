-- ============================================================================
--  Migracion SIN PERDER DATOS: de la base vieja a la actual
--
--  Para que sirve: si restauras en Neon una copia anterior a los cambios, esa
--  copia tiene el esquema viejo (frentes_trabajo, actividades.valor_m2, sin
--  tareas). Este script la lleva al esquema nuevo conservando las filas, en
--  vez de recrear las tablas.
--
--  La idea de fondo: lo que RENOMBRA o RELLENA se hace aqui con SQL, y lo que
--  solo AGREGA (tablas y columnas nuevas) lo hace despues "prisma db push",
--  que sin nada que borrar ya no pide --accept-data-loss.
--
--  ORDEN:
--    1. PASO 1 de este archivo, en el editor SQL de Neon
--    2. revisar el listado de elementos sin medidas y completarlos
--    3. PASO 2 de este archivo
--    4. npx prisma db push          <- aditivo, sin --force-reset ni --accept-data-loss
--    5. PASO 3 de este archivo
--    6. npm run db:constraints
--
--  Si el paso 4 avisa de que va a borrar algo, PARA y revisa: a esa altura no
--  deberia quedar nada por borrar.
-- ============================================================================

-- --- PASO 1: renombrar y pasar las medidas al elemento ----------------------
BEGIN;

ALTER TABLE frentes_trabajo RENAME TO elementos_constructivos;
ALTER TABLE elementos_constructivos RENAME COLUMN id_frente TO id_elemento;
ALTER TABLE registros_ejecucion RENAME COLUMN id_frente TO id_elemento;

-- Las medidas pasan a vivir en el elemento. Se toman del registro mas antiguo
-- de cada uno, que es el que abrio su obra y las llevaba copiadas.
UPDATE elementos_constructivos e
SET largo = r.largo, alto = r.alto
FROM (
  SELECT DISTINCT ON (id_elemento) id_elemento, largo, alto
  FROM registros_ejecucion
  WHERE largo IS NOT NULL AND alto IS NOT NULL
  ORDER BY id_elemento, id_ejecucion
) r
WHERE e.id_elemento = r.id_elemento
  AND (e.largo IS NULL OR e.alto IS NULL);

COMMIT;

-- Los elementos que nunca tuvieron obra se quedan sin medidas, y la columna
-- pasa a ser obligatoria. Mira cuales son:
SELECT id_elemento, codigo_dwg, descripcion
FROM elementos_constructivos
WHERE largo IS NULL OR alto IS NULL;

-- ...y completalos antes de seguir, uno a uno o en bloque:
-- UPDATE elementos_constructivos SET largo = 3.00, alto = 2.40 WHERE id_elemento = 123;


-- --- PASO 2: fijar las medidas y guardar los precios viejos ------------------
BEGIN;

ALTER TABLE elementos_constructivos
  ALTER COLUMN largo SET NOT NULL,
  ALTER COLUMN alto  SET NOT NULL;

-- El precio deja la actividad y pasa al trabajador. Se respalda antes, porque
-- el paso siguiente borra la columna.
CREATE TABLE IF NOT EXISTS respaldo_precios_actividad AS
SELECT id_actividad, valor_m2 FROM actividades WHERE valor_m2 IS NOT NULL;

ALTER TABLE actividades DROP COLUMN IF EXISTS valor_m2;

COMMIT;


-- --- PASO 3: repartir los precios, ya con la tabla nueva creada -------------
-- Correr DESPUES de "npx prisma db push", que es quien crea
-- trabajador_actividad y tareas y agrega las columnas nuevas.

INSERT INTO trabajador_actividad (id_trabajador, id_actividad, valor_m2)
SELECT t.id_trabajador, r.id_actividad, r.valor_m2
FROM trabajadores t
CROSS JOIN respaldo_precios_actividad r
ON CONFLICT (id_trabajador, id_actividad) DO NOTHING;

DROP TABLE IF EXISTS respaldo_precios_actividad;
