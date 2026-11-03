// src/components/GestionCalificaciones.jsx

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { InputNumber } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { Badge } from 'primereact/badge';

import { catalogosService } from '../../../Servicios/catalogoServicios/catalogosService';
import { calificacionesService } from '../../../Servicios/calificacionesServicios/calificacionesService2';
import { useAuth } from '../../../context/AuthContext';

export const GestionCalificaciones = () => {
  const toastRef = useRef(null);
  const { user } = useAuth();

  // Filtros
  const [asignacionesRaw, setAsignacionesRaw] = useState([]);
  const [niveles, setNiveles] = useState([]);
  const [grados, setGrados] = useState([]);
  const [salones, setSalones] = useState([]);
  const [asignaturas, setAsignaturas] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [nivelSeleccionado, setNivelSeleccionado] = useState(null);
  const [gradoSeleccionado, setGradoSeleccionado] = useState(null);
  const [salonSeleccionado, setSalonSeleccionado] = useState(null);
  const [asignaturaSeleccionada, setAsignaturaSeleccionada] = useState(null);
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState(null);
  const [globalFilter, setGlobalFilter] = useState('');

  // Estados de interfaz
  const [estudiantes, setEstudiantes] = useState([]);
  const [estadoEdicion, setEstadoEdicion] = useState(null);
  const [loadingCatalogos, setLoadingCatalogos] = useState(false);
  const [loadingTabla, setLoadingTabla] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [descargandoPDF, setDescargandoPDF] = useState(false);
  const [calificacionesGuardadas, setCalificacionesGuardadas] = useState(false);
  const permiteEdicion = Number(estadoEdicion?.permiteEdicion) > 0;

  const opcionesAsignaturas = useMemo(() => {
    const idDocente = asignacionesRaw[0]?.id_docente;
    return asignaturas.map((asignatura) => ({
      ...asignatura,
      iddetalle_plan_de_estudio: asignatura.id,
      id_docente: idDocente,
      idSalon: salonSeleccionado?.id,
      label: asignatura.descripcion
    }));
  }, [asignacionesRaw, asignaturas, salonSeleccionado]);

  const opcionesPeriodos = useMemo(() => periodos.map((periodo) => ({
    ...periodo,
    idperiodo_evaluativo: periodo.id
  })), [periodos]);

  // Cargar Catálogos Iniciales
  useEffect(() => {
    const cargarCatalogos = async () => {
      if (user?.id == null) {
        toastRef.current?.show({
          severity: 'error',
          summary: 'Error de sesión',
          detail: 'No se encontró el ID del docente. Vuelva a iniciar sesión.',
          life: 4000
        });
        return;
      }

      setLoadingCatalogos(true);
      try {
        const [dataNiveles, dataPeriodos, dataAsignaciones] = await Promise.all([
          calificacionesService.getNivelesCombo(),
          calificacionesService.getPeriodosEvaluativosCombo(),
          catalogosService.getAsignacionesDocente(user.id),
        ]);
        setNiveles(dataNiveles);
        setPeriodos(dataPeriodos);
        setAsignacionesRaw(dataAsignaciones);
      } catch (error) {
        toastRef.current?.show({
          severity: 'error',
          summary: 'Error de Catálogos',
          detail: error.message || 'No se pudieron cargar las asignaciones.',
          life: 4000
        });
      } finally {
        setLoadingCatalogos(false);
      }
    };

    cargarCatalogos();
  }, [user?.id]);

  // Manejadores de Selección
  const limpiarSeleccionAcademica = useCallback(() => {
    setGradoSeleccionado(null);
    setSalones([]);
    setSalonSeleccionado(null);
    setAsignaturas([]);
    setAsignaturaSeleccionada(null);
    setEstudiantes([]);
    setEstadoEdicion(null);
    setCalificacionesGuardadas(false);
  }, []);

  const handleNivelChange = useCallback(async (e) => {
    const nivel = e.value;
    setNivelSeleccionado(nivel);
    limpiarSeleccionAcademica();
    setGrados([]);
    if (!nivel) return;

    setLoadingCatalogos(true);
    try {
      const data = await calificacionesService.getGradosCombo(nivel.id);
      setGrados(data);
    } catch (error) {
      toastRef.current?.show({
        severity: 'error',
        summary: 'Error de Catálogos',
        detail: error.message || 'No se pudieron cargar los grados.',
        life: 4000
      });
    } finally {
      setLoadingCatalogos(false);
    }
  }, [limpiarSeleccionAcademica]);

  const handleGradoChange = useCallback(async (e) => {
    const grado = e.value;
    setGradoSeleccionado(grado);
    setSalones([]);
    setSalonSeleccionado(null);
    setAsignaturas([]);
    setAsignaturaSeleccionada(null);
    setEstudiantes([]);
    setEstadoEdicion(null);
    setCalificacionesGuardadas(false);
    if (!grado) return;

    setLoadingCatalogos(true);
    try {
      const data = await calificacionesService.getSalonesCombo(grado.id);
      setSalones(data);
    } catch (error) {
      toastRef.current?.show({
        severity: 'error',
        summary: 'Error de Catálogos',
        detail: error.message || 'No se pudieron cargar los salones.',
        life: 4000
      });
    } finally {
      setLoadingCatalogos(false);
    }
  }, []);

  const handleSalonChange = useCallback(async (e) => {
    const salon = e.value;
    setSalonSeleccionado(salon);
    setAsignaturas([]);
    setAsignaturaSeleccionada(null);
    setEstudiantes([]);
    setEstadoEdicion(null);
    setCalificacionesGuardadas(false);
    if (!salon || !gradoSeleccionado) return;

    const idDocente = asignacionesRaw[0]?.id_docente;
    if (idDocente == null) {
      toastRef.current?.show({
        severity: 'error',
        summary: 'Docente',
        detail: 'EL Docente no Tiene Materias Asignadas',
        life: 4000
      });
      return;
    }

    setLoadingCatalogos(true);
    try {
      const data = await calificacionesService.getAsignaturasSeccionesCombo(
        gradoSeleccionado.id,
        idDocente,
        salon.id
      );
      setAsignaturas(data);
    } catch (error) {
      toastRef.current?.show({
        severity: 'error',
        summary: 'Error de Catálogos',
        detail: error.message || 'No se pudieron cargar las asignaturas.',
        life: 4000
      });
    } finally {
      setLoadingCatalogos(false);
    }
  }, [asignacionesRaw, gradoSeleccionado]);

  const handleAsignaturaChange = useCallback((e) => {
    setAsignaturaSeleccionada(e.value);
    setEstudiantes([]);
    setEstadoEdicion(null);
    setCalificacionesGuardadas(false);
  }, []);

  const handlePeriodoChange = useCallback((e) => {
    setPeriodoSeleccionado(e.value);
    setEstudiantes([]);
    setEstadoEdicion(null);
    setCalificacionesGuardadas(false);
  }, []);

  const esPeriodoCerrado = estadoEdicion !== null && !permiteEdicion;

  // Consulta de Nómina
  const handleConsultarNomina = useCallback(async () => {
    if (!asignaturaSeleccionada || !periodoSeleccionado) {
      toastRef.current?.show({
        severity: 'warn',
        summary: 'Atención',
        detail: 'Seleccione Grado, Asignatura y Periodo Evaluativo.',
        life: 3000
      });
      return;
    }

    setLoadingTabla(true);
    setEstadoEdicion(null);
    setEstudiantes([]);
    setCalificacionesGuardadas(false);
    try {
      const estado = await calificacionesService.getEstadoEdicionPeriodoEvaluativo(
        periodoSeleccionado.idperiodo_evaluativo,
        asignaturaSeleccionada.iddetalle_plan_de_estudio
      );
      const data = await calificacionesService.getEstudiantesTabla(
        asignaturaSeleccionada.iddetalle_plan_de_estudio,
        periodoSeleccionado.idperiodo_evaluativo,
        asignaturaSeleccionada.id_docente,
        asignaturaSeleccionada.idSalon
      );

      // Inicializar estructura con propiedades de validación
      const estudiantesMapeados = data.map((est) => {
        return {
          ...est,
          idEstudiante: est.idMatricula ?? est.idEstudiante,
          codigoMINED: est.codigoMined ?? est.codigoMINED,
          codigoEstudiante: est.codEstudiante ?? est.codigoEstudiante,
          nombreCompleto: est.nombreCompletoEstudiante ?? est.nombreCompleto,
          acumulado: est.acumulado ?? null,
          examen: est.examen ?? null,
          errorAcumulado: null,
          errorExamen: null,
          dirty: false
        };
      });

      setEstadoEdicion(estado);
      setEstudiantes(estudiantesMapeados);
      if (!(Number(estado?.permiteEdicion) > 0)) {
        toastRef.current?.show({
          severity: 'warn',
          summary: 'Edición cerrada',
          detail: estado?.mensajePantalla
            || 'No se pueden editar las notas porque el período para ingresar notas está cerrado.',
          life: 5000
        });
      }
    } catch (error) {
      toastRef.current?.show({
        severity: 'error',
        summary: 'Error de Carga',
        detail: error.message || 'Error al obtener la nómina de estudiantes.',
        life: 4000
      });
    } finally {
      setLoadingTabla(false);
    }
  }, [asignaturaSeleccionada, periodoSeleccionado]);

  /**
   * Manejador de cambio con validación explícita (Mantiene el valor sin auto-recorte)
   */
  const handleNotaFieldChange = useCallback((idEstudiante, campo, nuevoValor) => {
    if (!permiteEdicion || guardando) return;
    setCalificacionesGuardadas(false);
    setEstudiantes((prevEstudiantes) =>
      prevEstudiantes.map((est) => {
        if (est.idEstudiante === idEstudiante) {
          const val = nuevoValor ?? null;
          const fueraDeRango =
            (campo === 'acumulado' && val !== null && (val < 0 || val > 40)) ||
            (campo === 'examen' && val !== null && (val < 0 || val > 60));
          const valorAplicado = fueraDeRango ? est[campo] : val;
          const acumuladoActual = campo === 'acumulado' ? valorAplicado : est.acumulado;
          const examenActual = campo === 'examen' ? valorAplicado : est.examen;

          // Validaciones explícitas de rango
          let errorAcumulado = est.errorAcumulado;
          let errorExamen = est.errorExamen;

          if (campo === 'acumulado') {
            if (val !== null && (val < 0 || val > 40)) {
              errorAcumulado = 'La nota debe estar entre 0 y 40 puntos.';
            } else {
              errorAcumulado = null;
            }
          }

          if (campo === 'examen') {
            if (val !== null && (val < 0 || val > 60)) {
              errorExamen = 'La nota debe estar entre 0 y 60 puntos.';
            } else {
              errorExamen = null;
            }
          }

          const acSanitizado = errorAcumulado || acumuladoActual === null ? 0 : acumuladoActual;
          const exSanitizado = errorExamen || examenActual === null ? 0 : examenActual;
          const notaFinalCalculada = Number((acSanitizado + exSanitizado).toFixed(2));

          return {
            ...est,
            [campo]: valorAplicado,
            errorAcumulado,
            errorExamen,
            notaFinal: notaFinalCalculada,
            dirty: true
          };
        }
        return est;
      })
    );
  }, [permiteEdicion, guardando]);

  // Validación de errores activos en la nómina
  const registrosModificados = useMemo(() => estudiantes.filter((est) => est.dirty), [estudiantes]);
  const tieneErroresValidacion = useMemo(() => {
    return estudiantes.some((est) => Boolean(est.errorAcumulado) || Boolean(est.errorExamen));
  }, [estudiantes]);

  // Métricas del grupo en tiempo real
  const kpis = useMemo(() => {
    if (estudiantes.length === 0) return { promedio: 0, aprobados: 0, reprobados: 0, pendientes: 0 };
    
    let sumaTotal = 0;
    let aprobados = 0;
    let reprobados = 0;
    let pendientes = 0;

    estudiantes.forEach((est) => {
      if (est.acumulado === null || est.examen === null) {
        pendientes++;
      }
      sumaTotal += est.notaFinal || 0;
      if ((est.notaFinal || 0) >= 60) {
        aprobados++;
      } else {
        reprobados++;
      }
    });

    return {
      promedio: (sumaTotal / estudiantes.length).toFixed(1),
      aprobados,
      reprobados,
      pendientes
    };
  }, [estudiantes]);

  // Guardado Masivo
  const handleGuardarBatch = async () => {
    if (tieneErroresValidacion) {
      toastRef.current?.show({
        severity: 'error',
        summary: 'Validación de Notas',
        detail: 'Existen notas que superan el límite permitido. Corríjalas antes de guardar.',
        life: 4000
      });
      return;
    }

    if (registrosModificados.length === 0) {
      toastRef.current?.show({
        severity: 'info',
        summary: 'Sin Cambios',
        detail: 'No hay calificaciones pendientes de guardar.',
        life: 3000
      });
      return;
    }

    setGuardando(true);
    setCalificacionesGuardadas(false);
    setEstadoEdicion(null);
    try {
      const estado = await calificacionesService.getEstadoEdicionPeriodoEvaluativo(
        periodoSeleccionado.idperiodo_evaluativo,
        asignaturaSeleccionada.iddetalle_plan_de_estudio
      );
      setEstadoEdicion(estado);
      if (!(Number(estado?.permiteEdicion) > 0)) {
        toastRef.current?.show({
          severity: 'warn',
          summary: 'Edición cerrada',
          detail: estado?.mensajePantalla
            || 'No se pueden editar las notas porque el período para ingresar notas está cerrado.',
          life: 5000
        });
        return;
      }

      const payload = {
        idDetallePlanDeEstudio: asignaturaSeleccionada.iddetalle_plan_de_estudio,
        idDocente: asignaturaSeleccionada.id_docente,
        idPeriodoEvaluativo: periodoSeleccionado.idperiodo_evaluativo,
        calificaciones: registrosModificados.map((est) => ({
          idMatricula: est.idMatricula ?? est.idEstudiante,
          acumulado: est.acumulado,
          examen: est.examen
        }))
      };

      const resp = await calificacionesService.guardarCalificacionesBatch(payload);
      setEstudiantes((prev) => prev.map((est) => ({ ...est, dirty: false })));
      setCalificacionesGuardadas(true);

      toastRef.current?.show({
        severity: 'success',
        summary: 'Guardado Exitoso',
        detail: resp.message || 'Calificaciones registradas correctamente.',
        life: 3000
      });
    } catch (error) {
      toastRef.current?.show({
        severity: 'error',
        summary: 'Error al Guardar',
        detail: error.message || 'No se pudieron guardar las calificaciones.',
        life: 4000
      });
    } finally {
      setGuardando(false);
    }
  };

  // Descarga de PDF Jaspersoft
  const handleDescargarActa = async () => {
    if (!asignaturaSeleccionada || !periodoSeleccionado) return;
    if (!calificacionesGuardadas || registrosModificados.length > 0) {
      toastRef.current?.show({
        severity: 'warn',
        summary: 'Calificaciones pendientes',
        detail: 'Guarde las calificaciones antes de generar el acta.',
        life: 4000
      });
      return;
    }

    setDescargandoPDF(true);
    try {
      await calificacionesService.descargarActaCalificacionesPDF(
        asignaturaSeleccionada.iddetalle_plan_de_estudio,
        periodoSeleccionado.idperiodo_evaluativo
      );
      toastRef.current?.show({
        severity: 'success',
        summary: 'Reporte Generado',
        detail: 'El acta oficial en PDF se generó correctamente.',
        life: 3000
      });
    } catch (error) {
      toastRef.current?.show({
        severity: 'error',
        summary: 'Error en Reporte',
        detail: error.message || 'No se pudo generar el documento PDF.',
        life: 4000
      });
    } finally {
      setDescargandoPDF(false);
    }
  };

  // Plantillas de Renderizado de Celdas
  const editorAcumuladoTemplate = (rowData) => {
    const tieneError = Boolean(rowData.errorAcumulado);
    return (
      <div className="flex flex-column align-items-center gap-1 p-1">
        <InputNumber
          value={rowData.acumulado}
          onValueChange={(e) => handleNotaFieldChange(rowData.idEstudiante, 'acumulado', e.value)}
          minFractionDigits={0}
          maxFractionDigits={2}
          disabled={!permiteEdicion || guardando}
          className={tieneError ? 'p-invalid w-full' : 'w-full'}
          inputClassName="text-center font-semibold"
        />
        {tieneError && (
          <small className="p-error text-xs block font-bold text-center">
            {rowData.errorAcumulado}
          </small>
        )}
      </div>
    );
  };

  const editorExamenTemplate = (rowData) => {
    const tieneError = Boolean(rowData.errorExamen);
    return (
      <div className="flex flex-column align-items-center gap-1 p-1">
        <InputNumber
          value={rowData.examen}
          onValueChange={(e) => handleNotaFieldChange(rowData.idEstudiante, 'examen', e.value)}
          minFractionDigits={0}
          maxFractionDigits={2}
          disabled={!permiteEdicion || guardando}
          className={tieneError ? 'p-invalid w-full' : 'w-full'}
          inputClassName="text-center font-semibold"
        />
        {tieneError && (
          <small className="p-error text-xs block font-bold text-center">
            {rowData.errorExamen}
          </small>
        )}
      </div>
    );
  };

  const notaFinalTemplate = (rowData) => {
    const esAprobado = rowData.notaFinal >= 60;
    const tieneErrorFila = Boolean(rowData.errorAcumulado) || Boolean(rowData.errorExamen);

    return (
      <div className="flex align-items-center justify-content-center gap-2">
        <span className={`font-bold text-lg ${tieneErrorFila ? 'text-400' : ''}`}>
          {tieneErrorFila ? '--' : rowData.notaFinal}
        </span>
        {!tieneErrorFila && (
          <Tag
            value={esAprobado ? 'AP' : 'REP'}
            severity={esAprobado ? 'success' : 'danger'}
          />
        )}
      </div>
    );
  };

  const headerTabla = (
    <div className="flex flex-column md:flex-row justify-content-between align-items-center gap-3">
      <div className="flex align-items-center gap-2">
        <span className="p-input-icon-left w-full md:w-auto">
          <i className="pi pi-search" />
          <InputText
            type="search"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Buscar por estudiante o código MINED..."
            className="w-full md:w-20rem"
          />
        </span>
      </div>

      {estudiantes.length > 0 && (
        <div className="flex flex-wrap gap-3 align-items-center text-sm">
          <span>Promedio: <strong>{kpis.promedio} pts</strong></span>
          <span>Aprobados: <Tag severity="success" value={kpis.aprobados} /></span>
          <span>Reprobados: <Tag severity="danger" value={kpis.reprobados} /></span>
          {kpis.pendientes > 0 && (
            <span>Pendientes: <Tag severity="warning" value={kpis.pendientes} /></span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="p-3">
      <Toast ref={toastRef} />

      <Card title="Sistema Integrado de Gestión Escolar - Evaluación por Corte" className="mb-4">
        {esPeriodoCerrado && (
          <div className="p-message p-message-warn mb-3 p-2 border-round flex align-items-center gap-2">
            <i className="pi pi-lock text-xl"></i>
            <span className="font-semibold">
              {estadoEdicion?.mensajePantalla
                || 'No se pueden editar las notas porque el período para ingresar notas está cerrado.'}
            </span>
          </div>
        )}

        <div className="p-fluid grid formgrid">
          <div className="col-12 col-md-4 mb-3">
            <label htmlFor="combo-nivel" className="font-bold block mb-2">
              Nivel Educativo:
            </label>
            <Dropdown
              id="combo-nivel"
              value={nivelSeleccionado}
              options={niveles}
              onChange={handleNivelChange}
              optionLabel="descripcion"
              placeholder="-- Seleccione Nivel --"
              loading={loadingCatalogos}
              filter
              className="w-full"
            />
          </div>

          <div className="col-12 col-md-4 mb-3">
            <label htmlFor="combo-grado" className="font-bold block mb-2">
              Grado Académico:
            </label>
            <Dropdown
              id="combo-grado"
              value={gradoSeleccionado}
              options={grados}
              onChange={handleGradoChange}
              optionLabel="descripcion"
              placeholder={!nivelSeleccionado ? 'Seleccione un nivel primero' : '-- Seleccione Grado --'}
              loading={loadingCatalogos}
              disabled={!nivelSeleccionado}
              filter
              className="w-full"
            />
          </div>

          <div className="col-12 col-md-4 mb-3">
            <label htmlFor="combo-salon" className="font-bold block mb-2">
              Salón:
            </label>
            <Dropdown
              id="combo-salon"
              value={salonSeleccionado}
              options={salones}
              onChange={handleSalonChange}
              optionLabel="descripcion"
              placeholder={!gradoSeleccionado ? 'Seleccione un grado primero' : '-- Seleccione Salón --'}
              loading={loadingCatalogos}
              disabled={!gradoSeleccionado}
              filter
              className="w-full"
            />
          </div>

          <div className="col-12 col-md-4 mb-3">
            <label htmlFor="combo-asignatura" className="font-bold block mb-2">
              Asignatura / Sección:
            </label>
            <Dropdown
              id="combo-asignatura"
              value={asignaturaSeleccionada}
              options={opcionesAsignaturas}
              onChange={handleAsignaturaChange}
              optionLabel="label"
              placeholder={!salonSeleccionado ? 'Seleccione un salón primero' : '-- Seleccione Asignatura --'}
              loading={loadingCatalogos}
              disabled={!salonSeleccionado}
              filter
              className="w-full"
            />
          </div>

          <div className="col-12 col-md-4 mb-3">
            <label htmlFor="combo-periodo" className="font-bold block mb-2">
              Periodo Evaluativo:
            </label>
            <Dropdown
              id="combo-periodo"
              value={periodoSeleccionado}
              options={opcionesPeriodos}
              onChange={handlePeriodoChange}
              optionLabel="descripcion"
              placeholder="-- Seleccione Periodo --"
              loading={loadingCatalogos}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-content-end mt-2">
          <Button
            label="Cargar Estudiantes"
            icon="pi pi-search"
            className="p-button-primary"
            onClick={handleConsultarNomina}
            loading={loadingTabla}
            disabled={!asignaturaSeleccionada || !periodoSeleccionado}
          />
          <Button
            label="Guardar Calificaciones"
            icon="pi pi-save"
            className="p-button-primary"
            onClick={handleGuardarBatch}
            loading={guardando}
            disabled={estudiantes.length === 0 || !permiteEdicion || tieneErroresValidacion}
          >
            {registrosModificados.length > 0 && (
              <Badge value={registrosModificados.length} severity="warning" className="ml-2" />
            )}
          </Button>
          <Button
            label="Descargar Acta (PDF)"
            icon="pi pi-file-pdf"
            className="p-button-primary"
            onClick={handleDescargarActa}
            loading={descargandoPDF}
            disabled={
              estudiantes.length === 0 ||
              !calificacionesGuardadas ||
              registrosModificados.length > 0 ||
              guardando ||
              descargandoPDF
            }
          />
        </div>
      </Card>

      <Card>
        <DataTable
          value={estudiantes}
          loading={loadingTabla}
          globalFilter={globalFilter}
          globalFilterFields={['codigoMINED', 'codigoEstudiante', 'nombreCompleto']}
          header={headerTabla}
          emptyMessage="No hay datos de estudiantes cargados para la combinación seleccionada."
          responsiveLayout="scroll"
          stripedRows
          showGridlines
        >
          <Column field="codigoMINED" header="Código MINED" style={{ width: '10%' }} sortable />
          <Column field="codigoEstudiante" header="Código Est." style={{ width: '10%' }} sortable />
          <Column field="nombreCompleto" header="Nombre del Estudiante" style={{ width: '28%' }} sortable />
          <Column
            field="acumulado"
            header="Acumulado (0-40)"
            body={editorAcumuladoTemplate}
            style={{ width: '15%', textAlign: 'center' }}
          />
          <Column
            field="examen"
            header="Examen (0-60)"
            body={editorExamenTemplate}
            style={{ width: '15%', textAlign: 'center' }}
          />
          <Column
            field="notaFinal"
            header="Nota Final (100 pts)"
            body={notaFinalTemplate}
            style={{ width: '12%', textAlign: 'center' }}
            sortable
          />
        </DataTable>
      </Card>
    </div>
  );
};

export default GestionCalificaciones;
