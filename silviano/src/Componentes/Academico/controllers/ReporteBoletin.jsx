import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { AutoComplete } from 'primereact/autocomplete';
import { Toast } from 'primereact/toast';
import {
  buscarEstudiantesMatricula,
  buscarSeccionesPorGrado,
  descargarBoletin,
} from '../../../Servicios/ReporteServicios/reportesService';
import { getGrados } from '../../../Servicios/GradoServicios/gradoService';

export const ReporteBoletin = () => {
  const toast = useRef(null);
  const [loading, setLoading] = useState(false);
  const [loadingEstudianteAuto, setLoadingEstudianteAuto] = useState(false);
  const [loadingGrados, setLoadingGrados] = useState(false);
  const [loadingSecciones, setLoadingSecciones] = useState(false);
  const [grados, setGrados] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const anioActual = new Date().getFullYear();

  // Combo de Años Lectivos dinámico desde 1990 hasta el año actual
  const opcionesAnios = useMemo(() => {
    const anios = [];
    for (let yr = anioActual; yr >= 1990; yr--) {
      anios.push({ label: `${yr}`, value: yr });
    }
    return anios;
  }, [anioActual]);

  // Estado unificado e inmutable del formulario
  const [formData, setFormData] = useState({
    modalidad: 'individual',
    tipoReporte: null,
    periodoLectivo: anioActual,
    numeroPeriodo: null,
    codigoMined: '',
    idPersona: null,
    idGrado: null,
    seccion: null,
  });

  const opcionesModalidad = useMemo(() => [
    { label: 'Boletín por estudiante', value: 'individual' },
    { label: 'Boletín final masivo por grado', value: 'masivo' },
  ], []);

  const opcionesTipoReporte = useMemo(() => [
    { label: 'Boletín Parcial', value: 'parcial' },
    { label: 'Boletín Final', value: 'final' },
  ], []);

  const opcionesGrados = useMemo(
    () =>
      grados.map((grado) => ({
        label: grado.nombreGrado || grado.nombre || grado.descripcion || 'Grado sin nombre',
        value: grado.idGrado ?? grado.idgrado ?? grado.id,
      })),
    [grados]
  );

  const opcionesSecciones = useMemo(
    () => secciones.map((seccion) => ({ label: seccion, value: seccion })),
    [secciones]
  );

  const opcionesPeriodos = useMemo(() => [
    { label: 'I PARCIAL', value: 1 },
    { label: 'II PARCIAL', value: 2 },
    { label: 'III PARCIAL', value: 3 },
    { label: 'IV PARCIAL', value: 4 },
    { label: 'V PARCIAL', value: 5 },
  ], []);

  // Estados independientes para la búsqueda y autocompletado
  const [busquedaEstudianteInput, setBusquedaEstudianteInput] = useState('');
  const [sugerenciasEstudiantes, setSugerenciasEstudiantes] = useState([]);

  useEffect(() => {
    let active = true;
    const cargarGrados = async () => {
      setLoadingGrados(true);
      try {
        const gradosData = await getGrados();
        if (active) setGrados(gradosData);
      } catch (error) {
        if (active) {
          toast.current?.show({
            severity: 'error',
            summary: 'Error al cargar grados',
            detail: error.message || 'No se pudieron cargar los grados.',
            life: 4000,
          });
        }
      } finally {
        if (active) setLoadingGrados(false);
      }
    };

    cargarGrados();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (formData.modalidad !== 'masivo' || !formData.idGrado) {
      setSecciones([]);
      setLoadingSecciones(false);
      return () => {
        active = false;
      };
    }

    const cargarSecciones = async () => {
      setLoadingSecciones(true);
      try {
        const seccionesData = await buscarSeccionesPorGrado(formData.idGrado);
        if (active) setSecciones(seccionesData);
      } catch (error) {
        if (active) {
          setSecciones([]);
          toast.current?.show({
            severity: 'error',
            summary: 'Error al cargar secciones',
            detail: error.message || 'No se pudieron cargar las secciones del grado.',
            life: 4000,
          });
        }
      } finally {
        if (active) setLoadingSecciones(false);
      }
    };

    cargarSecciones();
    return () => {
      active = false;
    };
  }, [formData.modalidad, formData.idGrado]);

  // Handler para inputs primitivos de texto con validación de tildes
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    const strVal = value ?? '';
    setFormData((prev) => ({ ...prev, [name]: strVal }));
  }, []);

  // Handler inmutable para el Dropdown de años
  const handleDropdownChange = useCallback((name, value) => {
    const valorPrimitivo = typeof value === 'object' && value !== null ? value.value : value;
    setFormData((prev) => ({ ...prev, [name]: valorPrimitivo }));
  }, []);

  const handleModalidadChange = (modalidad) => {
    setFormData((prev) => ({
      ...prev,
      modalidad,
      tipoReporte: null,
      numeroPeriodo: null,
      codigoMined: '',
      idPersona: null,
      idGrado: null,
      seccion: null,
    }));
    setBusquedaEstudianteInput('');
    setSugerenciasEstudiantes([]);
  };

  // Búsqueda en la API mediante AutoComplete
  const handleCompleteEstudiantes = async (e) => {
    const query = e.query ? e.query.trim() : '';
    if (!query) {
      setSugerenciasEstudiantes([]);
      return;
    }

    setLoadingEstudianteAuto(true);
    try {
      const resultados = await buscarEstudiantesMatricula(query);

      // Normalización de datos devueltos por el backend
      const datosFormateados = resultados.map((est) => {
        const idPersonaExtrahido = est.idPersona || est.id_persona || est.id || null;
        const codigoMinedExtraido = est.codigoMined || est.codigo_mined || est.codigo || '';
        const nombreStr = est.nombre_completo || `${est.nombres || ''} ${est.apellidos || ''}`.trim();

        return {
          ...est,
          idPersona: idPersonaExtrahido,
          codigoMined: codigoMinedExtraido,
          labelEstudiante: codigoMinedExtraido 
            ? `[${codigoMinedExtraido}] - ${nombreStr}` 
            : nombreStr,
        };
      });

      setSugerenciasEstudiantes(datosFormateados);
    } catch (error) {
      setSugerenciasEstudiantes([]);
      toast.current?.show({
        severity: 'error',
        summary: 'Error de Búsqueda',
        detail: 'No se pudieron cargar las sugerencias de estudiantes.',
      });
    } finally {
      setLoadingEstudianteAuto(false);
    }
  };

  // Selección de un estudiante desde la lista desplegable
  const handleSelectEstudiante = (e) => {
    const item = e.value;
    if (!item) return;

    setBusquedaEstudianteInput(item.labelEstudiante || '');
    setFormData((prev) => ({
      ...prev,
      idPersona: item.idPersona,
      codigoMined: item.codigoMined || '',
    }));
  };

  // Template personalizado para renderizar cada elemento en la lista desplegable
  const estudianteItemTemplate = (item) => {
    return (
      <div className="flex align-items-center justify-content-between p-1">
        <div>
          <span className="font-bold block text-800">{item.labelEstudiante}</span>
          {item.cedula && <small className="text-500">Cédula: {item.cedula}</small>}
        </div>
        {item.codigoMined && (
          <span className="p-tag p-tag-info font-normal text-xs">
            MINED: {item.codigoMined}
          </span>
        )}
      </div>
    );
  };

  // Handler principal para envío del formulario y generación del PDF
  const handleGenerarBoletin = async (e) => {
    e.preventDefault();

    if (formData.modalidad === 'individual' && !formData.tipoReporte) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Campo requerido',
        detail: 'Debe seleccionar si desea generar un boletín parcial o final.',
      });
      return;
    }

    if (formData.modalidad === 'masivo' && !formData.idGrado) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Campo requerido',
        detail: 'Debe seleccionar el grado para generar los boletines.',
      });
      return;
    }

    if (formData.modalidad === 'masivo' && !formData.seccion) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Campo requerido',
        detail: 'Debe seleccionar la sección para generar los boletines.',
      });
      return;
    }

    if (
      formData.modalidad === 'individual' &&
      !formData.codigoMined.trim() &&
      !formData.idPersona
    ) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Campo requerido',
        detail: 'Debe ingresar un Código MINED o seleccionar un estudiante para continuar.',
      });
      return;
    }

    if (
      formData.modalidad === 'individual' &&
      formData.tipoReporte === 'parcial' &&
      !formData.numeroPeriodo
    ) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Campo requerido',
        detail: 'Debe seleccionar el período del boletín parcial.',
      });
      return;
    }

    setLoading(true);
    try {
      await descargarBoletin({
        modalidad: formData.modalidad,
        idGrado: formData.modalidad === 'masivo' ? formData.idGrado : undefined,
        seccion: formData.modalidad === 'masivo' ? formData.seccion : undefined,
        idPersona: formData.modalidad === 'individual' ? formData.idPersona : undefined,
        codigoMined: formData.modalidad === 'individual' ? formData.codigoMined : '',
        anioLectivo: formData.periodoLectivo,
        tipoReporte: formData.modalidad === 'masivo' ? 'final' : formData.tipoReporte,
        numeroPeriodo:
          formData.modalidad === 'individual' && formData.tipoReporte === 'parcial'
            ? formData.numeroPeriodo
            : undefined,
      });

      toast.current?.show({
        severity: 'success',
        summary: 'Boletín Generado',
        detail: 'El archivo PDF se ha descargado correctamente.',
      });
    } catch (error) {
      toast.current?.show({
        severity: 'error',
        summary: 'Error al generar reporte',
        detail: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4 shadow-1 border-round bg-white">
      <Toast ref={toast} />

      <div className="flex align-items-center gap-2 mb-4">
        <i className="bx bx-file text-primary text-3xl"></i>
        <div>
          <h3 className="text-xl font-bold m-0 text-800">
            Emisión de Boletín Académico 
          </h3>
          <small className="text-500">
            Generación oficial de boletines de calificaciones 
          </small>
        </div>
      </div>

      <form onSubmit={handleGenerarBoletin} className="p-fluid grid">
        <div className="col-12 col-md-6 mb-3">
          <label htmlFor="modalidad" className="font-semibold block mb-2 text-700">
            Generación
          </label>
          <Dropdown
            id="modalidad"
            value={formData.modalidad}
            options={opcionesModalidad}
            optionLabel="label"
            optionValue="value"
            onChange={(e) => handleModalidadChange(e.value)}
            placeholder="Seleccione cómo generar el boletín"
          />
        </div>

        {/* Tipo de boletín individual */}
        {formData.modalidad === 'individual' && (
        <div className="col-12 col-md-6 mb-3">
          <label htmlFor="tipoReporte" className="font-semibold block mb-2 text-700">
            Tipo de Boletín
          </label>
          <Dropdown
            id="tipoReporte"
            name="tipoReporte"
            value={formData.tipoReporte}
            options={opcionesTipoReporte}
            optionLabel="label"
            optionValue="value"
            onChange={(e) => handleDropdownChange('tipoReporte', e.value)}
            placeholder="Seleccione el tipo de boletín"
          />
        </div>
        )}

        {/* Período únicamente para boletines parciales */}
        {formData.modalidad === 'individual' && formData.tipoReporte === 'parcial' && (
          <div className="col-12 col-md-6 mb-3">
            <label htmlFor="numeroPeriodo" className="font-semibold block mb-2 text-700">
              Período
            </label>
            <Dropdown
              id="numeroPeriodo"
              name="numeroPeriodo"
              value={formData.numeroPeriodo}
              options={opcionesPeriodos}
              optionLabel="label"
              optionValue="value"
              onChange={(e) => handleDropdownChange('numeroPeriodo', e.value)}
              placeholder="Seleccione el período"
            />
          </div>
        )}

        {/* Selector de Año Lectivo (1990 - Año Actual) */}
        <div className="col-12 col-md-4 mb-3">
          <label htmlFor="periodoLectivo" className="font-semibold block mb-2 text-700">
            Año Lectivo
          </label>
          <Dropdown
            id="periodoLectivo"
            name="periodoLectivo"
            value={formData.periodoLectivo}
            options={opcionesAnios}
            optionLabel="label"
            optionValue="value"
            onChange={(e) => handleDropdownChange('periodoLectivo', e.value)}
            placeholder="Seleccione el Año"
            filter
          />
        </div>

        {formData.modalidad === 'individual' ? (
        <>
        <div className="col-12 mb-3 surface-50 p-3 border-round border-1 surface-border">
          <label htmlFor="autoEstudiante" className="font-bold block mb-2 text-700">
            🔍 Buscar Estudiante Existente (Código MINED o Nombres, ej: '123' o 'William')
          </label>
          <AutoComplete
            id="autoEstudiante"
            value={busquedaEstudianteInput}
            suggestions={sugerenciasEstudiantes}
            completeMethod={handleCompleteEstudiantes}
            field="labelEstudiante"
            itemTemplate={estudianteItemTemplate}
            onChange={(e) => {
              const val = e.value;
              setBusquedaEstudianteInput(typeof val === 'string' ? val : val?.labelEstudiante || '');
              if (typeof val === 'string') {
                setFormData((prev) => ({
                  ...prev,
                  idPersona: null,
                  codigoMined: '',
                }));
              }
            }}
            onSelect={handleSelectEstudiante}
            placeholder="Escriba código MINED o nombre del alumno..."
            loading={loadingEstudianteAuto}
            dropdown
            emptyMessage="No se encontraron estudiantes"
            className="w-full"
          />
        </div>

        {/* Código MINED del Estudiante */}
        <div className="col-12 col-md-6 mb-3">
          <label htmlFor="codigoMined" className="font-semibold block mb-2 text-700">
            Código MINED Estudiante
          </label>
          <InputText
            id="codigoMined"
            name="codigoMined"
            value={formData.codigoMined}
            onChange={handleInputChange}
            placeholder="Ej. MINED-2026-88"
          />
        </div>
        </>
        ) : (
          <div className="col-12 col-md-6 mb-3">
            <label htmlFor="idGrado" className="font-semibold block mb-2 text-700">
              Grado
            </label>
            <Dropdown
              id="idGrado"
              value={formData.idGrado}
              options={opcionesGrados}
              optionLabel="label"
              optionValue="value"
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  idGrado: e.value,
                  seccion: null,
                }));
                setSecciones([]);
              }}
              placeholder={loadingGrados ? 'Cargando grados...' : 'Seleccione el grado'}
              loading={loadingGrados}
              disabled={loadingGrados}
              filter
            />
          </div>
        )}

        {formData.modalidad === 'masivo' && formData.idGrado && (
          <div className="col-12 col-md-6 mb-3">
            <label htmlFor="seccion" className="font-semibold block mb-2 text-700">
              Sección
            </label>
            <Dropdown
              id="seccion"
              value={formData.seccion}
              options={opcionesSecciones}
              optionLabel="label"
              optionValue="value"
              onChange={(e) => handleDropdownChange('seccion', e.value)}
              placeholder={
                loadingSecciones ? 'Cargando secciones...' : 'Seleccione la sección'
              }
              loading={loadingSecciones}
              disabled={loadingSecciones || secciones.length === 0}
            />
            {!loadingSecciones && secciones.length === 0 && (
              <small className="p-error block mt-1">
                No hay secciones disponibles para este grado.
              </small>
            )}
          </div>
        )}

        {/* Botón de Envío */}
        <div className="col-12 flex justify-content-end gap-2 mt-2">
          <Button
            type="submit"
            label={formData.modalidad === 'masivo' ? 'Generar Boletines del Grado' : 'Generar Boletín'}
            icon="pi pi-file-pdf"
            loading={loading}
            disabled={
              loading ||
              (formData.modalidad === 'masivo' &&
                (loadingGrados || loadingSecciones || !formData.seccion))
            }
            className="p-button-primary font-bold"
          />
        </div>
      </form>
    </div>
  );
};

export default ReporteBoletin;