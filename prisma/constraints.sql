-- Reglas que Prisma no puede expresar (CHECK e indices parciales).
-- Se aplican despues de cada "prisma db push" con: npm run db:constraints
-- Todas se pueden correr varias veces.

-- --- registros_ejecucion ---
-- Que lo ejecutado no pase de la cantidad total lo valida la API (es entre filas).

ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_m2_ejecutados_positivo;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_m2_ejecutados_positivo
  CHECK (m2_ejecutados > 0);

ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_receso_positivo;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_receso_positivo
  CHECK (tiempo_receso_min >= 0);

-- Meta 0 = sin meta: se guarda NULL.
UPDATE registros_ejecucion SET m2_meta = NULL WHERE m2_meta = 0;

ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_meta_positiva;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_meta_positiva
  CHECK (m2_meta IS NULL OR m2_meta > 0);

ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_hora_final_mayor;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_hora_final_mayor
  CHECK (hora_final > hora_inicio);

-- El receso debe dejar tiempo de trabajo.
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_receso_menor_jornada;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_receso_menor_jornada
  CHECK (tiempo_receso_min < EXTRACT(EPOCH FROM (hora_final - hora_inicio)) / 60);

ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_largo_positivo;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_largo_positivo
  CHECK (largo IS NULL OR largo >= 0);

ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_alto_positivo;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_alto_positivo
  CHECK (alto IS NULL OR alto >= 0);

-- La apertura lleva medidas; los avances no.
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_apertura_con_medidas;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_apertura_con_medidas
  CHECK (
    (id_registro_origen IS NULL AND largo IS NOT NULL AND alto IS NOT NULL)
    OR id_registro_origen IS NOT NULL
  );

-- El numero de avance solo va en los avances.
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_numero_avance;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_numero_avance
  CHECK (
    (id_registro_origen IS NULL AND numero_avance IS NULL)
    OR (id_registro_origen IS NOT NULL AND numero_avance >= 1)
  );

-- Un registro no puede ser avance de si mismo.
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_cadena_coherente;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_cadena_coherente
  CHECK (id_registro_anterior IS NULL OR id_registro_anterior <> id_ejecucion);

-- El precio copiado no puede ser negativo (cero si).
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_valor_m2_positivo;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_valor_m2_positivo
  CHECK (valor_m2 IS NULL OR valor_m2 >= 0);

-- Solo la apertura lleva tarea.
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_tarea_solo_apertura;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_tarea_solo_apertura
  CHECK (id_tarea IS NULL OR id_registro_origen IS NULL);

-- Completa cantidad_total en obras viejas: ml = largo, lo demas largo x alto.
-- Solo toca filas vacias.
UPDATE registros_ejecucion r
   SET cantidad_total = CASE WHEN a.unidad_medida = 'ml' THEN r.largo ELSE ROUND(r.largo * r.alto, 2) END
  FROM actividades a
 WHERE a.id_actividad = r.id_actividad
   AND r.id_registro_origen IS NULL
   AND r.cantidad_total IS NULL
   AND r.largo IS NOT NULL
   AND r.alto IS NOT NULL;

-- La apertura lleva cantidad total; los avances no.
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_cantidad_total;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_cantidad_total
  CHECK (
    (id_registro_origen IS NULL AND cantidad_total > 0)
    OR (id_registro_origen IS NOT NULL AND cantidad_total IS NULL)
  );

-- Una sola obra por elemento y actividad.
DROP INDEX IF EXISTS uq_obra_elemento_actividad;
CREATE UNIQUE INDEX uq_obra_elemento_actividad
  ON registros_ejecucion (id_elemento, id_actividad)
  WHERE id_registro_origen IS NULL;

-- --- tareas ---

ALTER TABLE tareas DROP CONSTRAINT IF EXISTS chk_tarea_meta_positiva;
ALTER TABLE tareas ADD CONSTRAINT chk_tarea_meta_positiva
  CHECK (m2_meta IS NULL OR m2_meta > 0);

ALTER TABLE tareas DROP CONSTRAINT IF EXISTS chk_tarea_fechas_coherentes;
ALTER TABLE tareas ADD CONSTRAINT chk_tarea_fechas_coherentes
  CHECK (fecha_fin_plan IS NULL OR fecha_inicio_plan IS NULL OR fecha_fin_plan >= fecha_inicio_plan);

-- Una sola tarea por elemento y actividad.
DROP INDEX IF EXISTS uq_tarea_elemento_actividad;
CREATE UNIQUE INDEX uq_tarea_elemento_actividad
  ON tareas (id_elemento, id_actividad);

-- --- elementos_constructivos ---

ALTER TABLE elementos_constructivos DROP CONSTRAINT IF EXISTS chk_elemento_largo_positivo;
ALTER TABLE elementos_constructivos ADD CONSTRAINT chk_elemento_largo_positivo
  CHECK (largo > 0);

ALTER TABLE elementos_constructivos DROP CONSTRAINT IF EXISTS chk_elemento_alto_positivo;
ALTER TABLE elementos_constructivos ADD CONSTRAINT chk_elemento_alto_positivo
  CHECK (alto > 0);

-- Los vanos no pueden ocupar todo el elemento.
ALTER TABLE elementos_constructivos DROP CONSTRAINT IF EXISTS chk_elemento_area_vanos;
ALTER TABLE elementos_constructivos ADD CONSTRAINT chk_elemento_area_vanos
  CHECK (area_vanos >= 0 AND area_vanos < largo * alto);

-- --- vanos ---

ALTER TABLE vanos DROP CONSTRAINT IF EXISTS chk_vano_medidas;
ALTER TABLE vanos ADD CONSTRAINT chk_vano_medidas
  CHECK (largo > 0 AND ancho > 0);

-- --- trabajador_actividad ---
-- Precio cero permitido.

ALTER TABLE trabajador_actividad DROP CONSTRAINT IF EXISTS chk_tarifa_valor_m2_positivo;
ALTER TABLE trabajador_actividad ADD CONSTRAINT chk_tarifa_valor_m2_positivo
  CHECK (valor_m2 >= 0);

-- --- metas ---

ALTER TABLE metas DROP CONSTRAINT IF EXISTS chk_meta_rendimiento_positivo;
ALTER TABLE metas ADD CONSTRAINT chk_meta_rendimiento_positivo
  CHECK (rendimiento_objetivo IS NULL OR rendimiento_objetivo > 0);

ALTER TABLE metas DROP CONSTRAINT IF EXISTS chk_meta_m2_positivo;
ALTER TABLE metas ADD CONSTRAINT chk_meta_m2_positivo
  CHECK (m2_objetivo IS NULL OR m2_objetivo > 0);

ALTER TABLE metas DROP CONSTRAINT IF EXISTS chk_meta_vigencia_coherente;
ALTER TABLE metas ADD CONSTRAINT chk_meta_vigencia_coherente
  CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde);

-- --- proyectos ---

ALTER TABLE proyectos DROP CONSTRAINT IF EXISTS chk_proyecto_fechas_coherentes;
ALTER TABLE proyectos ADD CONSTRAINT chk_proyecto_fechas_coherentes
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio);

-- --- pisos ---

ALTER TABLE pisos DROP CONSTRAINT IF EXISTS chk_piso_numero_valido;
ALTER TABLE pisos ADD CONSTRAINT chk_piso_numero_valido
  CHECK (numero >= -10 AND numero <= 200);

-- --- cuadrilla_trabajador ---

ALTER TABLE cuadrilla_trabajador DROP CONSTRAINT IF EXISTS chk_asignacion_fechas_coherentes;
ALTER TABLE cuadrilla_trabajador ADD CONSTRAINT chk_asignacion_fechas_coherentes
  CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio);

-- Un trabajador solo tiene una asignacion activa a la vez.
DROP INDEX IF EXISTS uq_trabajador_asignacion_activa;
CREATE UNIQUE INDEX uq_trabajador_asignacion_activa
  ON cuadrilla_trabajador (id_trabajador)
  WHERE activo = true;

-- --- liquidaciones ---

ALTER TABLE liquidaciones DROP CONSTRAINT IF EXISTS chk_liquidacion_fechas;
ALTER TABLE liquidaciones ADD CONSTRAINT chk_liquidacion_fechas
  CHECK (hasta >= desde);

ALTER TABLE liquidaciones DROP CONSTRAINT IF EXISTS chk_liquidacion_total;
ALTER TABLE liquidaciones ADD CONSTRAINT chk_liquidacion_total
  CHECK (total > 0);

ALTER TABLE liquidacion_lineas DROP CONSTRAINT IF EXISTS chk_linea_valores;
ALTER TABLE liquidacion_lineas ADD CONSTRAINT chk_linea_valores
  CHECK (cantidad > 0 AND valor_unitario >= 0 AND subtotal >= 0 AND jornadas > 0);
