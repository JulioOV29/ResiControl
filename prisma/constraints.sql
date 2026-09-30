-- ============================================================================
--  Reglas de integridad que Prisma no expresa en el schema.
--  Se aplican despues de cada "prisma db push" con:  npm run db:constraints
--  Todas las sentencias son idempotentes: se pueden correr cuantas veces sea.
-- ============================================================================

-- --- registros_ejecucion ----------------------------------------------------
-- Que lo acumulado de una obra no pase de su area es una regla entre filas,
-- asi que no cabe en un CHECK: la valida la API antes de guardar.

ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_m2_ejecutados_positivo;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_m2_ejecutados_positivo
  CHECK (m2_ejecutados > 0);

ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_receso_positivo;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_receso_positivo
  CHECK (tiempo_receso_min >= 0);

-- Una meta de cero no es una meta: era la forma que tenia el formulario de
-- decir "sin meta", y hacia que la jornada contara como incumplida. Ahora una
-- jornada sin meta guarda NULL y se queda fuera del cumplimiento.
UPDATE registros_ejecucion SET m2_meta = NULL WHERE m2_meta = 0;

ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_meta_positiva;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_meta_positiva
  CHECK (m2_meta IS NULL OR m2_meta > 0);

ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_hora_final_mayor;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_hora_final_mayor
  CHECK (hora_final > hora_inicio);

-- El receso nunca puede consumir toda la jornada: debe quedar tiempo efectivo.
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_receso_menor_jornada;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_receso_menor_jornada
  CHECK (tiempo_receso_min < EXTRACT(EPOCH FROM (hora_final - hora_inicio)) / 60);

ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_largo_positivo;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_largo_positivo
  CHECK (largo IS NULL OR largo >= 0);

ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_alto_positivo;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_alto_positivo
  CHECK (alto IS NULL OR alto >= 0);

-- El registro que abre una obra lleva sus medidas; los avances no las repiten.
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_apertura_con_medidas;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_apertura_con_medidas
  CHECK (
    (id_registro_origen IS NULL AND largo IS NOT NULL AND alto IS NOT NULL)
    OR id_registro_origen IS NOT NULL
  );

-- El numero de subregistro va con los avances, nunca con el que abre la obra.
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_numero_avance;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_numero_avance
  CHECK (
    (id_registro_origen IS NULL AND numero_avance IS NULL)
    OR (id_registro_origen IS NOT NULL AND numero_avance >= 1)
  );

-- Una obra no puede ser avance de si misma.
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_cadena_coherente;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_cadena_coherente
  CHECK (id_registro_anterior IS NULL OR id_registro_anterior <> id_ejecucion);

-- La tarifa congelada en la jornada no puede ser negativa. Cero si se admite:
-- hay trabajo que se registra y no se paga por unidad ejecutada.
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_valor_m2_positivo;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_valor_m2_positivo
  CHECK (valor_m2 IS NULL OR valor_m2 >= 0);

-- La tarea la lleva el registro que ABRE la obra. Un avance no cuelga de una
-- tarea: hereda la suya a traves del registro de origen.
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_tarea_solo_apertura;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_tarea_solo_apertura
  CHECK (id_tarea IS NULL OR id_registro_origen IS NULL);

-- La cantidad total de la obra, en la unidad de su actividad. Las obras que
-- existian antes de esta columna se completan con la regla de su unidad:
-- m2 = largo x alto, ml = largo, y cualquier otra con largo x alto, que es lo
-- que venian usando. Solo toca filas vacias, asi que se puede correr siempre.
UPDATE registros_ejecucion r
   SET cantidad_total = CASE WHEN a.unidad_medida = 'ml' THEN r.largo ELSE ROUND(r.largo * r.alto, 2) END
  FROM actividades a
 WHERE a.id_actividad = r.id_actividad
   AND r.id_registro_origen IS NULL
   AND r.cantidad_total IS NULL
   AND r.largo IS NOT NULL
   AND r.alto IS NOT NULL;

-- La apertura lleva su cantidad total; los avances no la repiten.
ALTER TABLE registros_ejecucion DROP CONSTRAINT IF EXISTS chk_reg_cantidad_total;
ALTER TABLE registros_ejecucion ADD CONSTRAINT chk_reg_cantidad_total
  CHECK (
    (id_registro_origen IS NULL AND cantidad_total > 0)
    OR (id_registro_origen IS NOT NULL AND cantidad_total IS NULL)
  );

-- Una sola obra por elemento y actividad. Si hubiera dos, el area del muro se
-- contaria dos veces en el panel. El segundo dia de trabajo no es otra obra: es
-- un avance de la primera. La API lo avisa antes; este indice es la red.
DROP INDEX IF EXISTS uq_obra_elemento_actividad;
CREATE UNIQUE INDEX uq_obra_elemento_actividad
  ON registros_ejecucion (id_elemento, id_actividad)
  WHERE id_registro_origen IS NULL;

-- --- tareas -----------------------------------------------------------------

ALTER TABLE tareas DROP CONSTRAINT IF EXISTS chk_tarea_meta_positiva;
ALTER TABLE tareas ADD CONSTRAINT chk_tarea_meta_positiva
  CHECK (m2_meta IS NULL OR m2_meta > 0);

ALTER TABLE tareas DROP CONSTRAINT IF EXISTS chk_tarea_fechas_coherentes;
ALTER TABLE tareas ADD CONSTRAINT chk_tarea_fechas_coherentes
  CHECK (fecha_fin_plan IS NULL OR fecha_inicio_plan IS NULL OR fecha_fin_plan >= fecha_inicio_plan);

-- Una sola tarea por elemento y actividad, por la misma razon que la obra: dos
-- encargos del mismo trabajo acababan abriendo dos obras sobre el mismo muro.
DROP INDEX IF EXISTS uq_tarea_elemento_actividad;
CREATE UNIQUE INDEX uq_tarea_elemento_actividad
  ON tareas (id_elemento, id_actividad);

-- --- elementos_constructivos ------------------------------------------------
-- Las medidas del elemento se toman una sola vez, al darlo de alta, y de ahi
-- las heredan la tarea y el registro de obra.

ALTER TABLE elementos_constructivos DROP CONSTRAINT IF EXISTS chk_elemento_largo_positivo;
ALTER TABLE elementos_constructivos ADD CONSTRAINT chk_elemento_largo_positivo
  CHECK (largo > 0);

ALTER TABLE elementos_constructivos DROP CONSTRAINT IF EXISTS chk_elemento_alto_positivo;
ALTER TABLE elementos_constructivos ADD CONSTRAINT chk_elemento_alto_positivo
  CHECK (alto > 0);

-- --- trabajador_actividad ---------------------------------------------------
-- El precio por metro se acuerda con la persona, no con la actividad. Cero se
-- admite: hay trabajo que se registra y no se paga por unidad ejecutada.

ALTER TABLE trabajador_actividad DROP CONSTRAINT IF EXISTS chk_tarifa_valor_m2_positivo;
ALTER TABLE trabajador_actividad ADD CONSTRAINT chk_tarifa_valor_m2_positivo
  CHECK (valor_m2 >= 0);

-- --- metas ------------------------------------------------------------------

ALTER TABLE metas DROP CONSTRAINT IF EXISTS chk_meta_rendimiento_positivo;
ALTER TABLE metas ADD CONSTRAINT chk_meta_rendimiento_positivo
  CHECK (rendimiento_objetivo IS NULL OR rendimiento_objetivo > 0);

ALTER TABLE metas DROP CONSTRAINT IF EXISTS chk_meta_m2_positivo;
ALTER TABLE metas ADD CONSTRAINT chk_meta_m2_positivo
  CHECK (m2_objetivo IS NULL OR m2_objetivo > 0);

ALTER TABLE metas DROP CONSTRAINT IF EXISTS chk_meta_vigencia_coherente;
ALTER TABLE metas ADD CONSTRAINT chk_meta_vigencia_coherente
  CHECK (vigencia_hasta IS NULL OR vigencia_hasta >= vigencia_desde);

-- --- proyectos --------------------------------------------------------------

ALTER TABLE proyectos DROP CONSTRAINT IF EXISTS chk_proyecto_fechas_coherentes;
ALTER TABLE proyectos ADD CONSTRAINT chk_proyecto_fechas_coherentes
  CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio);

-- --- pisos ------------------------------------------------------------------

ALTER TABLE pisos DROP CONSTRAINT IF EXISTS chk_piso_numero_valido;
ALTER TABLE pisos ADD CONSTRAINT chk_piso_numero_valido
  CHECK (numero >= -10 AND numero <= 200);

-- --- cuadrilla_trabajador ---------------------------------------------------

ALTER TABLE cuadrilla_trabajador DROP CONSTRAINT IF EXISTS chk_asignacion_fechas_coherentes;
ALTER TABLE cuadrilla_trabajador ADD CONSTRAINT chk_asignacion_fechas_coherentes
  CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio);

-- Un trabajador solo puede tener una asignacion activa a la vez.
DROP INDEX IF EXISTS uq_trabajador_asignacion_activa;
CREATE UNIQUE INDEX uq_trabajador_asignacion_activa
  ON cuadrilla_trabajador (id_trabajador)
  WHERE activo = true;

-- --- liquidaciones -----------------------------------------------------------

ALTER TABLE liquidaciones DROP CONSTRAINT IF EXISTS chk_liquidacion_fechas;
ALTER TABLE liquidaciones ADD CONSTRAINT chk_liquidacion_fechas
  CHECK (hasta >= desde);

ALTER TABLE liquidaciones DROP CONSTRAINT IF EXISTS chk_liquidacion_total;
ALTER TABLE liquidaciones ADD CONSTRAINT chk_liquidacion_total
  CHECK (total > 0);

ALTER TABLE liquidacion_lineas DROP CONSTRAINT IF EXISTS chk_linea_valores;
ALTER TABLE liquidacion_lineas ADD CONSTRAINT chk_linea_valores
  CHECK (cantidad > 0 AND valor_unitario >= 0 AND subtotal >= 0 AND jornadas > 0);
