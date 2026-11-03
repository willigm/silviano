import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Steps } from 'primereact/steps';
import { Card } from 'primereact/card';
import { AutoComplete } from 'primereact/autocomplete';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { RadioButton } from 'primereact/radiobutton';
import { Checkbox } from 'primereact/checkbox';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { Tag } from 'primereact/tag';

import {
  getCatalogosMatricula,
  buscarEstudiantesAuto,
  buscarTutoresAuto,
  buscarSolvenciaMatricula,
  obtenerGradosPorNivel,
  obtenerSalonesDisponibles,
  obtenerEstudiantePorCodigo,
  registrarMatriculaCompleta,
  descargarFichaMatriculaPDF
} from '../../Servicios/MatriculasServicios/matriculasService';

const PARENTESCOS = [
  { label: 'Padre', value: 'PADRE' },
  { label: 'Madre', value: 'MADRE' },
  { label: 'Abuelo/a', value: 'ABUELO' },
  { label: 'Tutor Legal', value: 'TUTOR_LEGAL' }
];

const ANIO_ACTUAL = new Date().getFullYear();

// REGEX CORREGIDA: Acepta letras con tildes (í, á, é, ó, ú), Ñ, ñ, diéresis y espacios
const REGEX_SOLO_LETRAS_ESPANOL = /^[\p{L}\s]+$/u;

// Formateador dinámico de Cédula Nicaragüense
const formatearCedulaDinamica = (valorRaw) => {
  if (!valorRaw) return '';
  const limpio = String(valorRaw).toUpperCase().replace(/[^0-9A-Z]/g, '');
  let resultado = '';
  
  for (let i = 0; i < limpio.length && i < 14; i++) {
    const char = limpio[i];
    if (i < 13 && !/\d/.test(char)) continue;
    if (i === 13 && !/[A-Z]/.test(char)) continue;

    if (i === 3) resultado += '-';
    if (i === 9) resultado += '-';
    resultado += char;
  }
  return resultado;
};

// Validador de Cédula CSE
const validarCedulaNicaraguense = (cedulaRaw) => {
  if (!cedulaRaw) return true;
  const cedula = String(cedulaRaw).trim();
  if (cedula === '') return true;

  const regexCedula = /^\d{3}-\d{6}-\d{4}[A-Z]$/;
  if (!regexCedula.test(cedula)) return false;

  const partes = cedula.split('-');
  const fechaStr = partes[1];
  
  const dia = parseInt(fechaStr.slice(0, 2), 10);
  const mes = parseInt(fechaStr.slice(2, 4), 10) - 1;
  const anioCorta = parseInt(fechaStr.slice(4, 6), 10);

  const anioActualCorta = ANIO_ACTUAL % 100;
  const siglo = anioCorta > anioActualCorta ? 1900 : 2000;
  const anioCompleto = siglo + anioCorta;

  const fechaNacimiento = new Date(anioCompleto, mes, dia);
  const hoy = new Date();

  const esFechaValida = 
    fechaNacimiento.getFullYear() === anioCompleto &&
    fechaNacimiento.getMonth() === mes &&
    fechaNacimiento.getDate() === dia;

  if (!esFechaValida || fechaNacimiento > hoy) return false;
  return true;
};

const INITIAL_REQUISITOS = Object.freeze({
  partidaNacimiento: false,
  fotoCarnet: false,
  boletinCalificaciones: false,
  hojaTraslado: false,
  constanciaConducta: false,
  dniTutores: false
});

const mapearTutoresEstudiante = (tutores) =>
  (Array.isArray(tutores) ? tutores : []).map((relacion, index) => {
    const tutor = relacion?.tutor || relacion || {};
    const idPersonaTutor =
      relacion?.idPersonaTutor ??
      relacion?.idpersonaTutor ??
      tutor.idPersonaTutor ??
      tutor.idPersona ??
      tutor.idpersona ??
      tutor.id;
    const nombreCompleto =
      tutor.nombreCompleto ||
      tutor.nombre_completo ||
      [tutor.nombres, tutor.apellidos].filter(Boolean).join(' ') ||
      tutor.nombre ||
      '';
    const parentesco =
      typeof relacion?.parentesco === 'object'
        ? relacion.parentesco.value || relacion.parentesco.nombre || 'PADRE'
        : relacion?.parentesco || 'PADRE';
    const rawTutor = {
      idPersonaTutor: idPersonaTutor ?? '',
      nombreCompleto,
      cedulaDni: tutor.cedulaDni || tutor.cedula || tutor.cedula_dni || '',
      parentesco,
      telefono: String(
        tutor.telefono || tutor.telefonoPrincipal || tutor.telefono_principal || ''
      ).replace(/\D/g, '').slice(0, 8),
      correo: tutor.correo || tutor.email || tutor.correo_electronico || '',
      esResponsableFinanciero: relacion?.esResponsableFinanciero ?? true
    };

    return {
      key: String(idPersonaTutor ?? `tutor-${index}`),
      label: `${nombreCompleto || 'Tutor sin nombre'}${parentesco ? ` - ${parentesco}` : ''}`,
      rawTutor
    };
  });

export const MatriculaScreenSteps = ({ onSuccess, onCancel }) => {
  const toast = useRef(null);
  
  const [activeIndex, setActiveIndex] = useState(0);

  const [loadingGuardado, setLoadingGuardado] = useState(false);
  const [loadingGrados, setLoadingGrados] = useState(false);
  const [loadingSalones, setLoadingSalones] = useState(false);
  
  const [loadingEstudianteAuto, setLoadingEstudianteAuto] = useState(false);
  const [loadingTutorAuto, setLoadingTutorAuto] = useState(false);
  const [loadingTutoresEstudiante, setLoadingTutoresEstudiante] = useState(false);
  const [estadoSolvencia, setEstadoSolvencia] = useState('idle');
  const [pagosMatricula, setPagosMatricula] = useState([]);
  const [errorSolvencia, setErrorSolvencia] = useState('');

  const [busquedaEstudianteInput, setBusquedaEstudianteInput] = useState('');
  const [sugerenciasEstudiantes, setSugerenciasEstudiantes] = useState([]);

  const [busquedaTutorInput, setBusquedaTutorInput] = useState('');
  const [sugerenciasTutores, setSugerenciasTutores] = useState([]);
  const [tutoresEstudiante, setTutoresEstudiante] = useState([]);
  const [tutorEstudianteSeleccionado, setTutorEstudianteSeleccionado] = useState('');
  const estudianteDetalleRequestId = useRef(0);

  const [listNiveles, setListNiveles] = useState([]);
  const [listGrados, setListGrados] = useState([]);
  const [listSalones, setListSalones] = useState([]);

  const [formData, setFormData] = useState({
    tipoIngreso: 'NUEVO',
    
    estudiante: {
      id: '',
      idPersona: '',
      idPersonaEstudiante: '',
      nombres: '',
      apellidos: '',
      codigoMined: '',
      alergiasEnfermedades: ''
    },

    tutor: {
      idPersonaTutor: '',
      nombreCompleto: '',
      cedulaDni: '',
      parentesco: '',
      telefono: '',
      correo: '',
      esResponsableFinanciero: true
    },

    idNivel: null,
    idGrado: null,
    idSalon: null,
    anioLectivo: ANIO_ACTUAL,

    requisitos: { ...INITIAL_REQUISITOS },

    pagoVerificado: false,
    numRecibo: ''
  });

  const [matriculaCreada, setMatriculaCreada] = useState(null);

  const handleLimpiarMatricula = () => {
    setFormData({
      tipoIngreso: 'NUEVO',
      estudiante: {
        id: '',
        idPersona: '',
        idPersonaEstudiante: '',
        nombres: '',
        apellidos: '',
        codigoMined: '',
        alergiasEnfermedades: ''
      },
      tutor: {
        idPersonaTutor: '',
        nombreCompleto: '',
        cedulaDni: '',
        parentesco: 'PADRE',
        telefono: '',
        correo: '',
        esResponsableFinanciero: true
      },
      idNivel: null,
      idGrado: null,
      idSalon: null,
      anioLectivo: ANIO_ACTUAL,
      requisitos: { ...INITIAL_REQUISITOS },
      pagoVerificado: false,
      numRecibo: ''
    });
    setActiveIndex(0);
    setMatriculaCreada(null);
    setListGrados([]);
    setListSalones([]);
    setBusquedaEstudianteInput('');
    setBusquedaTutorInput('');
    setSugerenciasEstudiantes([]);
    setSugerenciasTutores([]);
    setTutoresEstudiante([]);
    setTutorEstudianteSeleccionado('');
    estudianteDetalleRequestId.current += 1;
    setLoadingTutoresEstudiante(false);
    setEstadoSolvencia('idle');
    setPagosMatricula([]);
    setErrorSolvencia('');
  };

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const niveles = await getCatalogosMatricula();
      if (isMounted) setListNiveles(niveles);
    })();
    return () => { isMounted = false; };
  }, []);

  const handleCompleteEstudiantes = async (e) => {
    setLoadingEstudianteAuto(true);
    const resultados = await buscarEstudiantesAuto(e.query);
    setSugerenciasEstudiantes(resultados);
    setLoadingEstudianteAuto(false);
  };

  const handleCompleteTutores = async (e) => {
    setLoadingTutorAuto(true);
    const resultados = await buscarTutoresAuto(e.query);
    setSugerenciasTutores(resultados);
    setLoadingTutorAuto(false);
  };

  const handleSelectEstudiante = async (e) => {
    const item = e.value;
    if (!item || typeof item !== 'object') return;

    const rawEst = item.rawEstudiante || {};
    const rawTut = item.rawTutor || {};
    const codigoEstudiante =
      rawEst.codEstudiante ||
      rawEst.cod_estudiante ||
      item.codEstudiante ||
      item.cod_estudiante ||
      '';
    const requestId = ++estudianteDetalleRequestId.current;

    setFormData((prev) => ({
      ...prev,
      estudiante: {
        id: rawEst.id ?? '',
        idPersona: rawEst.idPersona ?? rawEst.id ?? '',
        idPersonaEstudiante: rawEst.idPersonaEstudiante ?? rawEst.id ?? '',
        nombres: rawEst.nombres ?? '',
        apellidos: rawEst.apellidos ?? '',
        codigoMined: rawEst.codigoMined ?? '',
        alergiasEnfermedades: rawEst.alergiasEnfermedades ?? 'Ninguna'
      },
      tutor: {
        idPersonaTutor: rawTut.idPersonaTutor ?? '',
        nombreCompleto: rawTut.nombreCompleto ?? '',
        cedulaDni: formatearCedulaDinamica(rawTut.cedulaDni ?? ''),
        parentesco: typeof rawTut.parentesco === 'object'
          ? (rawTut.parentesco?.value ?? 'PADRE')
          : (rawTut.parentesco ?? 'PADRE'),
        telefono: rawTut.telefono ?? '',
        correo: rawTut.correo ?? '',
        esResponsableFinanciero: rawTut.esResponsableFinanciero ?? true
      },
      pagoVerificado: false,
      numRecibo: ''
    }));

    setTutoresEstudiante([]);
    setTutorEstudianteSeleccionado('');
    setLoadingTutoresEstudiante(Boolean(codigoEstudiante));
    setBusquedaEstudianteInput(item.labelEstudiante || `${rawEst.codigoMined || ''} - ${rawEst.nombres || ''}`);
    setBusquedaTutorInput(item.labelTutor || `${rawTut.cedulaDni || ''} - ${rawTut.nombreCompleto || ''}`);

    toast.current?.show({
      severity: 'info',
      summary: 'Estudiante seleccionado',
      detail: 'Se cargaron los datos del estudiante.'
    });

    if (codigoEstudiante) {
      try {
        const detalle = await obtenerEstudiantePorCodigo(codigoEstudiante);
        if (requestId === estudianteDetalleRequestId.current) {
          const tutores = mapearTutoresEstudiante(detalle?.tutores);
          setTutoresEstudiante(tutores);
          if (tutores.length > 0) {
            setTutorEstudianteSeleccionado(tutores[0].key);
            setBusquedaTutorInput(tutores[0].label);
            setFormData((prev) => ({
              ...prev,
              tutor: tutores[0].rawTutor
            }));
          }
        }
      } catch (error) {
        if (requestId === estudianteDetalleRequestId.current) {
          toast.current?.show({
            severity: 'error',
            summary: 'No se pudieron cargar los tutores del estudiante',
            detail:
              error.response?.data?.message ||
              error.response?.data?.mensaje ||
              error.message ||
              'Ocurrió un error al consultar el expediente.',
            life: 4000
          });
        }
      } finally {
        if (requestId === estudianteDetalleRequestId.current) {
          setLoadingTutoresEstudiante(false);
        }
      }
    }
  };

  const handleSelectTutorEstudiante = (e) => {
    const tutorSeleccionado = tutoresEstudiante.find((tutor) => tutor.key === e.value);
    if (!tutorSeleccionado) return;

    setTutorEstudianteSeleccionado(tutorSeleccionado.key);
    setBusquedaTutorInput(tutorSeleccionado.label);
    setFormData((prev) => ({ ...prev, tutor: tutorSeleccionado.rawTutor }));
  };

  const handleSelectTutor = (e) => {
    const item = e.value;
    if (!item || typeof item !== 'object') return;

    const rawTutor = item.rawTutor || {};
    setTutorEstudianteSeleccionado('');
    setFormData((prev) => ({
      ...prev,
      tutor: {
        idPersonaTutor: rawTutor.idPersonaTutor ?? '',
        nombreCompleto: rawTutor.nombreCompleto ?? '',
        cedulaDni: formatearCedulaDinamica(rawTutor.cedulaDni ?? ''),
        parentesco: typeof rawTutor.parentesco === 'object'
          ? (rawTutor.parentesco?.value ?? 'PADRE')
          : (rawTutor.parentesco ?? 'PADRE'),
        telefono: rawTutor.telefono ?? '',
        correo: rawTutor.correo ?? '',
        esResponsableFinanciero: rawTutor.esResponsableFinanciero ?? true
      }
    }));
    setBusquedaTutorInput(item.labelTutor || rawTutor.nombreCompleto || '');

    toast.current?.show({
      severity: 'info',
      summary: 'Tutor seleccionado',
      detail: 'Se cargaron los datos del tutor sin modificar los datos del estudiante.'
    });
  };

  // Handlers con filtro en tiempo real para evitar bloquear letras con tilde
  const handleEstudianteChange = useCallback((e) => {
    const { name, value } = e.target;
    const strVal = value ?? '';

    if ((name === 'nombres' || name === 'apellidos') && strVal !== '' && !REGEX_SOLO_LETRAS_ESPANOL.test(strVal)) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      estudiante: { ...prev.estudiante, [name]: strVal }
    }));
  }, []);

  const handleTutorChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const strVal = value ?? '';

    if (name === 'nombreCompleto' && strVal !== '' && !REGEX_SOLO_LETRAS_ESPANOL.test(strVal)) {
      return;
    }

    if (name === 'telefono' && strVal !== '' && !/^\d*$/.test(strVal)) {
      return;
    }

    if (name === 'cedulaDni') {
      const cedulaFormateada = formatearCedulaDinamica(strVal);
      setFormData((prev) => ({
        ...prev,
        tutor: { ...prev.tutor, cedulaDni: cedulaFormateada }
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      tutor: {
        ...prev.tutor,
        [name]: type === 'checkbox' ? checked : (name === 'telefono' ? strVal.slice(0, 8) : strVal)
      }
    }));
  }, []);

  const handleNivelChange = useCallback(async (idNivel) => {
    setFormData((prev) => ({ ...prev, idNivel, idGrado: null, idSalon: null }));
    setListGrados([]);
    setListSalones([]);

    if (!idNivel) return;
    setLoadingGrados(true);
    const grados = await obtenerGradosPorNivel(idNivel);
    setListGrados(grados);
    setLoadingGrados(false);
  }, []);

  const handleGradoChange = useCallback(async (idGrado) => {
    setFormData((prev) => ({ ...prev, idGrado, idSalon: null }));
    setListSalones([]);

    if (!idGrado) return;
    setLoadingSalones(true);
    const salones = await obtenerSalonesDisponibles(idGrado, formData.anioLectivo);
    setListSalones(salones);
    setLoadingSalones(false);
  }, [formData.anioLectivo]);

  const handleRequisitoChange = useCallback((key, checked) => {
    setFormData((prev) => ({
      ...prev,
      requisitos: { ...prev.requisitos, [key]: checked }
    }));
  }, []);

  const handleTipoIngresoChange = useCallback((nuevoTipo) => {
    setFormData((prev) => ({
      ...prev,
      tipoIngreso: nuevoTipo,
      requisitos: nuevoTipo === 'REINGRESO' 
        ? {
            partidaNacimiento: true,
            fotoCarnet: false,
            boletinCalificaciones: false,
            hojaTraslado: true,
            constanciaConducta: true,
            dniTutores: true,
          }
        : { ...INITIAL_REQUISITOS }
    }));
  }, []);

  const estudianteItemTemplate = (item) => {
    const est = item.rawEstudiante || {};
    return (
      <div className="flex flex-column gap-1 p-1">
        <span className="font-bold text-primary">{est.nombres} {est.apellidos}</span>
        <span className="text-600 text-sm">Código MINED: {est.codigoMined || 'Sin código'}</span>
      </div>
    );
  };

  const tutorItemTemplate = (item) => {
    const tut = item.rawTutor || {};
    return (
      <div className="flex flex-column gap-1 p-1">
        <span className="font-bold text-800">{tut.nombreCompleto}</span>
        <small className="text-600">
          Cédula: <strong>{tut.cedulaDni || 'N/A'}</strong>
        </small>
      </div>
    );
  };

  // VALIDACIONES DEL PASO 1 CON EVALUACIÓN COMPATIBLE UNICODE
  const validacionesPaso0 = useMemo(() => {
    const nombres = String(formData.estudiante?.nombres ?? '').trim();
    const apellidos = String(formData.estudiante?.apellidos ?? '').trim();

    const nombreCompletoTutor = String(formData.tutor?.nombreCompleto ?? '').trim();
    const telefono = String(formData.tutor?.telefono ?? '').trim();
    const correo = String(formData.tutor?.correo ?? '').trim();
    const cedulaDni = String(formData.tutor?.cedulaDni ?? '').trim();

    const esNombresValido = nombres.length > 0 && REGEX_SOLO_LETRAS_ESPANOL.test(nombres);
    const esApellidosValido = apellidos.length > 0 && REGEX_SOLO_LETRAS_ESPANOL.test(apellidos);

    const esTutorNombreValido = nombreCompletoTutor.length > 0 && REGEX_SOLO_LETRAS_ESPANOL.test(nombreCompletoTutor);
    const esTelefonoValido = /^\d{8}$/.test(telefono);

    const esCedulaTutorValida = validarCedulaNicaraguense(cedulaDni);

    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const esCorreoValido = correo === '' || regexEmail.test(correo);

    const esValido = esNombresValido && esApellidosValido &&
                     esTutorNombreValido && esTelefonoValido && esCedulaTutorValida && esCorreoValido;

    return {
      esNombresValido,
      esApellidosValido,
      esTutorNombreValido,
      esTelefonoValido,
      esCedulaTutorValida,
      esCorreoValido,
      esValido
    };
  }, [formData.estudiante, formData.tutor]);

  const isPaso1Valido = useMemo(() => {
    return Boolean(formData.idNivel) && Boolean(formData.idGrado) && Boolean(formData.idSalon);
  }, [formData.idNivel, formData.idGrado, formData.idSalon]);

  const isPaso2Valido = useMemo(() => {
    const {
      partidaNacimiento,
      fotoCarnet,
      boletinCalificaciones,
      hojaTraslado,
      constanciaConducta,
      dniTutores
    } = formData.requisitos;

    if (formData.tipoIngreso === 'REINGRESO') {
      return Boolean(fotoCarnet) && Boolean(boletinCalificaciones);
    }

    return (
      Boolean(partidaNacimiento) &&
      Boolean(fotoCarnet) &&
      Boolean(boletinCalificaciones) &&
      Boolean(hojaTraslado) &&
      Boolean(constanciaConducta) &&
      Boolean(dniTutores)
    );
  }, [formData.tipoIngreso, formData.requisitos]);

  useEffect(() => {
    if (activeIndex !== 3) return undefined;

    const idPersona = Number(formData.estudiante.id);
    const anioLectivo = Number(formData.anioLectivo);
    if (!Number.isInteger(idPersona) || idPersona <= 0 || !Number.isInteger(anioLectivo)) {
      setEstadoSolvencia('error');
      setPagosMatricula([]);
      setErrorSolvencia('No se pudo identificar al estudiante o el año lectivo para verificar sus pagos.');
      return undefined;
    }

    let vigente = true;
    setEstadoSolvencia('loading');
    setPagosMatricula([]);
    setErrorSolvencia('');

    buscarSolvenciaMatricula(idPersona, anioLectivo)
      .then((pagos) => {
        if (!vigente) return;
        setPagosMatricula(pagos);
        const todosCancelados =
          pagos.length > 0 &&
          pagos.every((pago) => String(pago.estado || '').trim().toUpperCase() === 'CANCELADO');
        setEstadoSolvencia(todosCancelados ? 'paid' : pagos.length > 0 ? 'pending' : 'unpaid');

        const recibo = pagos
          .map((pago) => pago.numeroRecibo ?? pago.numRecibo ?? pago.numero_recibo ?? pago.num_recibo)
          .find(Boolean);
        setFormData((prev) => ({
          ...prev,
          pagoVerificado: todosCancelados,
          numRecibo: recibo ? String(recibo) : ''
        }));
      })
      .catch((error) => {
        if (!vigente) return;

        if (error.response?.status === 404) {
          setEstadoSolvencia('unpaid');
          setPagosMatricula([]);
          setFormData((prev) => ({ ...prev, pagoVerificado: false, numRecibo: '' }));
          return;
        }

        setEstadoSolvencia('error');
        setErrorSolvencia(
          error.response?.data?.message ||
          error.response?.data?.mensaje ||
          error.message ||
          'No fue posible consultar los pagos de matrícula.'
        );
      });

    return () => {
      vigente = false;
    };
  }, [activeIndex, formData.estudiante.id, formData.anioLectivo]);

  const puedeGuardarMatricula = useMemo(
    () =>
      estadoSolvencia === 'paid' &&
      pagosMatricula.length > 0 &&
      pagosMatricula.every((pago) => String(pago.estado || '').trim().toUpperCase() === 'CANCELADO'),
    [estadoSolvencia, pagosMatricula]
  );

  const montoMatriculaPagado = useMemo(
    () => pagosMatricula.reduce((total, pago) => total + Number(pago.totalPagado || 0), 0),
    [pagosMatricula]
  );

  const handleGuardarMatricula = async () => {
    if (!Number.isFinite(montoMatriculaPagado) || montoMatriculaPagado <= 0) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Monto pagado no disponible',
        detail: 'No se encontró un monto pagado válido en el detalle de solvencia.'
      });
      return;
    }

    if (!puedeGuardarMatricula) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Pago de Matrícula Pendiente',
        detail: 'No se puede guardar la matrícula hasta que todos los pagos del año lectivo estén cancelados.'
      });
      return;
    }

    setLoadingGuardado(true);
    try {
      const respuesta = await registrarMatriculaCompleta({
        ...formData,
        montoMatricula: montoMatriculaPagado
      });
      setMatriculaCreada(respuesta);

      toast.current?.show({
        severity: 'success',
        summary: 'Matrícula Completada',
        detail: 'Los datos han sido guardados exitosamente.'
      });

      if (onSuccess) onSuccess();
    } catch (error) {
      toast.current?.show({
        severity: 'error',
        summary: 'Error al Guardar',
        detail: error.response?.data?.message || 'Error de conexión con el servidor.'
      });
    } finally {
      setLoadingGuardado(false);
    }
  };

  const handleDescargarPDF = async () => {
    const id = matriculaCreada?.idMatricula;
    if (!id) {
      toast.current?.show({
        severity: 'error',
        summary: 'No se pudo imprimir',
        detail: 'La respuesta de matrícula no contiene el número de matrícula.'
      });
      return;
    }

    try {
      await descargarFichaMatriculaPDF(id);
    } catch (error) {
      toast.current?.show({
        severity: 'error',
        summary: 'Error PDF',
        detail: 'Ocurrió un fallo al descargar el reporte en PDF.'
      });
    }
  };

  const wizardSteps = [
    { label: 'Estudiante y Tutor' },
    { label: 'Ubicación Académica' },
    { label: 'Requisitos Previos' },
    { label: 'Solvencia y Finalización' }
  ];

  return (
    <div className="container-fluid px-2 px-md-4 py-3">
      <Toast ref={toast} />

      <Card className="shadow-2 border-round w-full">
        <h2 className="text-primary font-bold mb-4">Matrícula Escolar</h2>

        <Steps
          model={wizardSteps}
          activeIndex={activeIndex}
          readOnly={true}
          className="mb-5"
        />

        <div style={{ display: 'grid' }}>
          <div
            aria-hidden={activeIndex !== 0}
            style={{
              gridArea: '1 / 1',
              visibility: activeIndex === 0 ? 'visible' : 'hidden'
            }}
          >
          <div className="p-fluid grid">
            
            <div className="col-12 mt-2">
              <h5 className="font-bold text-primary mb-3">👦 Datos del Estudiante (Verificar y Actualizar)</h5>
            </div>

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
                  setBusquedaEstudianteInput(e.value);
                  if (typeof e.value === 'string') {
                    estudianteDetalleRequestId.current += 1;
                    setLoadingTutoresEstudiante(false);
                    setTutoresEstudiante([]);
                    setTutorEstudianteSeleccionado('');
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

            <div className="col-12 col-md-4 mb-3">
              <label htmlFor="nombres" className="font-bold block mb-1">
                Nombres <span className="text-red-500">*</span>
              </label>
              <InputText
                id="nombres"
                name="nombres"
                value={formData.estudiante.nombres}
                onChange={handleEstudianteChange}
                className={!validacionesPaso0.esNombresValido && formData.estudiante.nombres !== '' ? 'p-invalid' : ''}
              />
              {!validacionesPaso0.esNombresValido && formData.estudiante.nombres !== '' && (
                <small className="p-error block">Solo se permiten letras y espacios.</small>
              )}
            </div>

            <div className="col-12 col-md-4 mb-3">
              <label htmlFor="apellidos" className="font-bold block mb-1">
                Apellidos <span className="text-red-500">*</span>
              </label>
              <InputText
                id="apellidos"
                name="apellidos"
                value={formData.estudiante.apellidos}
                onChange={handleEstudianteChange}
                className={!validacionesPaso0.esApellidosValido && formData.estudiante.apellidos !== '' ? 'p-invalid' : ''}
              />
              {!validacionesPaso0.esApellidosValido && formData.estudiante.apellidos !== '' && (
                <small className="p-error block">Solo se permiten letras y espacios.</small>
              )}
            </div>

            <div className="col-12 col-md-4 mb-3">
              <label htmlFor="codigoMined" className="font-bold block mb-1">
                Código MINED
              </label>
              <InputText
                id="codigoMined"
                name="codigoMined"
                value={formData.estudiante.codigoMined}
                onChange={handleEstudianteChange}
                placeholder="Ej: EST-1024"
              />
            </div>

            <div className="col-12 mt-4">
              <h5 className="font-bold text-primary mb-3">👨‍👦 Datos del Padre o Tutor Legal (Verificar y Actualizar)</h5>
            </div>

            <div className="col-12 mb-3 surface-50 p-3 border-round border-1 surface-border">
              <label htmlFor="autoTutor" className="font-bold block mb-2 text-700">
                🔍 Buscar Padre / Tutor Legal Existente (Cédula CSE o Nombre del Tutor, ej: 'Elena' o '001-250885-0002K')
              </label>
              <AutoComplete
                id="autoTutor"
                value={busquedaTutorInput}
                suggestions={sugerenciasTutores}
                completeMethod={handleCompleteTutores}
                field="labelTutor"
                itemTemplate={tutorItemTemplate}
                onChange={(e) => setBusquedaTutorInput(e.value)}
                onSelect={handleSelectTutor}
                placeholder="Escriba número de cédula o nombre del padre/madre..."
                loading={loadingTutorAuto}
                dropdown
                emptyMessage="No se encontraron tutores con ese criterio"
                className="w-full"
              />
              {tutoresEstudiante.length > 0 && (
                <div className="mt-3">
                  <label htmlFor="tutorEstudiante" className="font-bold block mb-2 text-700">
                    Tutores asociados al estudiante
                  </label>
                  <Dropdown
                    id="tutorEstudiante"
                    value={tutorEstudianteSeleccionado}
                    options={tutoresEstudiante}
                    optionLabel="label"
                    optionValue="key"
                    onChange={handleSelectTutorEstudiante}
                    placeholder="Seleccione un tutor asociado"
                    className="w-full"
                  />
                </div>
              )}
              {loadingTutoresEstudiante && (
                <small className="text-primary block mt-2">
                  <i className="pi pi-spin pi-spinner mr-1" />
                  Cargando tutores asociados...
                </small>
              )}
            </div>

            <div className="col-12 col-md-6 mb-3">
              <label htmlFor="nombreCompletoTutor" className="font-bold block mb-1">
                Nombre Completo del Tutor <span className="text-red-500">*</span>
              </label>
              <InputText
                id="nombreCompletoTutor"
                name="nombreCompleto"
                value={formData.tutor.nombreCompleto}
                onChange={handleTutorChange}
                className={!validacionesPaso0.esTutorNombreValido && formData.tutor.nombreCompleto !== '' ? 'p-invalid' : ''}
              />
            </div>

            <div className="col-12 col-md-6 mb-3">
              <label htmlFor="cedulaDni" className="font-bold block mb-1">Cédula de Identidad del Tutor (CSE)</label>
              <InputText
                id="cedulaDni"
                name="cedulaDni"
                value={formData.tutor.cedulaDni}
                onChange={handleTutorChange}
                placeholder="001-250885-0002K"
                maxLength={16}
                className={!validacionesPaso0.esCedulaTutorValida && formData.tutor.cedulaDni !== '' ? 'p-invalid' : ''}
              />
              {!validacionesPaso0.esCedulaTutorValida && formData.tutor.cedulaDni !== '' && (
                <small className="p-error block">Cédula o fecha no válida / Letra final debe ser MAYÚSCULA.</small>
              )}
            </div>

            <div className="col-12 col-md-3 mb-3">
              <label htmlFor="parentesco" className="font-bold block mb-1">Parentesco</label>
              <Dropdown
                id="parentesco"
                name="parentesco"
                value={formData.tutor.parentesco}
                options={PARENTESCOS}
                optionLabel="label"
                optionValue="value"
                onChange={(e) => setFormData(p => ({
                  ...p,
                  tutor: { ...p.tutor, parentesco: e.value }
                }))}
                placeholder="Seleccione Parentesco"
                className="w-full"
              />
            </div>

            <div className="col-12 col-md-3 mb-3">
              <label htmlFor="telefono" className="font-bold block mb-1">
                Teléfono Móvil (8 dígitos) <span className="text-red-500">*</span>
              </label>
              <InputText
                id="telefono"
                name="telefono"
                value={formData.tutor.telefono}
                onChange={handleTutorChange}
                placeholder="88888888"
                maxLength={8}
                className={!validacionesPaso0.esTelefonoValido && formData.tutor.telefono !== '' ? 'p-invalid' : ''}
              />
              {!validacionesPaso0.esTelefonoValido && formData.tutor.telefono !== '' && (
                <small className="p-error block">Debe contener exactamente 8 dígitos numéricos.</small>
              )}
            </div>

            <div className="col-12 col-md-6 mb-3">
              <label htmlFor="correo" className="font-bold block mb-1">Correo Electrónico (opcional)</label>
              <InputText
                id="correo"
                name="correo"
                type="email"
                value={formData.tutor.correo}
                onChange={handleTutorChange}
                className={!validacionesPaso0.esCorreoValido ? 'p-invalid' : ''}
              />
            </div>

            <div className="col-12 col-md-6 mb-3 flex align-items-center">
              <div className="flex align-items-center gap-2 mt-3">
                <Checkbox
                  inputId="esResponsableFinanciero"
                  name="esResponsableFinanciero"
                  checked={formData.tutor.esResponsableFinanciero}
                  onChange={handleTutorChange}
                />
                <label htmlFor="esResponsableFinanciero" className="font-bold cursor-pointer text-sm">
                  Es el responsable financiero para cobros en Caja
                </label>
              </div>
            </div>

            <div className="col-12 flex justify-content-end gap-2 mt-4">
              {onCancel && <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined onClick={onCancel} />}
              <Button
                label="Siguiente"
                icon="pi pi-arrow-right"
                iconPos="right"
                disabled={!validacionesPaso0.esValido}
                onClick={() => setActiveIndex(1)}
              />
            </div>
          </div>
          </div>

          <div
            aria-hidden={activeIndex !== 1}
            style={{
              gridArea: '1 / 1',
              visibility: activeIndex === 1 ? 'visible' : 'hidden'
            }}
          >
          <div className="p-fluid grid">
            <div className="col-12 mb-3">
              <h5 className="font-bold text-700">Paso 2: Ubicación Académica y Salón</h5>
            </div>

            <div className="col-12 col-md-4 mb-3">
              <label htmlFor="selectNivel" className="font-bold block mb-1">Nivel Educativo *</label>
              <Dropdown
                id="selectNivel"
                value={formData.idNivel}
                options={listNiveles}
                optionLabel="label"
                optionValue="value"
                onChange={(e) => handleNivelChange(e.value)}
                placeholder="Seleccione el Nivel"
                className="w-full"
              />
            </div>

            <div className="col-12 col-md-4 mb-3">
              <label htmlFor="selectGrado" className="font-bold block mb-1">Grado Académico *</label>
              <Dropdown
                id="selectGrado"
                value={formData.idGrado}
                options={listGrados}
                optionLabel="label"
                optionValue="value"
                onChange={(e) => handleGradoChange(e.value)}
                placeholder="Seleccione el Grado"
                disabled={!formData.idNivel || loadingGrados}
                loading={loadingGrados}
                className="w-full"
              />
            </div>

            <div className="col-12 col-md-4 mb-3">
              <label htmlFor="selectSalon" className="font-bold block mb-1">Salón / Sección *</label>
              <Dropdown
                id="selectSalon"
                value={formData.idSalon}
                options={listSalones}
                optionLabel="label"
                optionValue="value"
                onChange={(e) => setFormData(p => ({ ...p, idSalon: e.value }))}
                placeholder="Seleccione el Aula"
                disabled={!formData.idGrado || loadingSalones}
                loading={loadingSalones}
                className="w-full"
              />
            </div>

            <div className="col-12 flex justify-content-between gap-2 mt-4">
              <Button label="Atrás" icon="pi pi-arrow-left" severity="secondary" outlined onClick={() => setActiveIndex(0)} />
              <Button
                label="Siguiente"
                icon="pi pi-arrow-right"
                iconPos="right"
                disabled={!isPaso1Valido}
                onClick={() => setActiveIndex(2)}
              />
            </div>
          </div>
          </div>

          <div
            aria-hidden={activeIndex !== 2}
            style={{
              gridArea: '1 / 1',
              visibility: activeIndex === 2 ? 'visible' : 'hidden'
            }}
          >
          <div className="p-fluid">
            <h5 className="font-bold text-700 mb-3">Paso 3: Recepción de Requisitos Físicos</h5>

            <div className="flex flex-wrap align-items-center gap-4 mb-4 pb-3 border-bottom-1 surface-border">
              <span className="font-bold text-700">Tipo de Ingreso:</span>
              <div className="flex align-items-center gap-2">
                <RadioButton
                  inputId="tipoNuevo"
                  name="tipoIngreso"
                  value="NUEVO"
                  onChange={() => handleTipoIngresoChange('NUEVO')}
                  checked={formData.tipoIngreso === 'NUEVO'}
                />
                <label htmlFor="tipoNuevo" className="cursor-pointer font-medium">Nuevo Ingreso</label>
              </div>

              <div className="flex align-items-center gap-2">
                <RadioButton
                  inputId="tipoReingreso"
                  name="tipoIngreso"
                  value="REINGRESO"
                  onChange={() => handleTipoIngresoChange('REINGRESO')}
                  checked={formData.tipoIngreso === 'REINGRESO'}
                />
                <label htmlFor="tipoReingreso" className="cursor-pointer font-medium">Reingreso</label>
              </div>
            </div>

            {formData.tipoIngreso === 'REINGRESO' && (
              <p className="text-primary text-sm mb-3">
                * Para estudiantes de <strong>Reingreso</strong> los documentos permanentes ya constan en archivo institucional.
              </p>
            )}

            <div className="grid">
              <div className="col-12 col-md-6 mb-3">
                <div className={`flex align-items-center gap-3 p-3 border-1 border-round ${formData.tipoIngreso === 'REINGRESO' ? 'surface-200 border-300' : 'surface-card surface-border'}`}>
                  <Checkbox
                    inputId="partidaNacimiento"
                    checked={formData.requisitos.partidaNacimiento}
                    disabled={formData.tipoIngreso === 'REINGRESO'}
                    onChange={(e) => handleRequisitoChange('partidaNacimiento', e.checked)}
                  />
                  <label htmlFor="partidaNacimiento" className="font-medium cursor-pointer">
                    1. Partida de Nacimiento (Original y Copia) {formData.tipoIngreso === 'REINGRESO' && '(En Archivo)'}
                  </label>
                </div>
              </div>

              <div className="col-12 col-md-6 mb-3">
                <div className="flex align-items-center gap-3 p-3 surface-card border-1 surface-border border-round">
                  <Checkbox
                    inputId="fotoCarnet"
                    checked={formData.requisitos.fotoCarnet}
                    onChange={(e) => handleRequisitoChange('fotoCarnet', e.checked)}
                  />
                  <label htmlFor="fotoCarnet" className="font-medium cursor-pointer">
                    2. Fotografía Tamaño Carnet Reciente <span className="text-red-500">*</span>
                  </label>
                </div>
              </div>

              <div className="col-12 col-md-6 mb-3">
                <div className="flex align-items-center gap-3 p-3 surface-card border-1 surface-border border-round">
                  <Checkbox
                    inputId="boletinCalificaciones"
                    checked={formData.requisitos.boletinCalificaciones}
                    onChange={(e) => handleRequisitoChange('boletinCalificaciones', e.checked)}
                  />
                  <label htmlFor="boletinCalificaciones" className="font-medium cursor-pointer">
                    3. Boletín de Calificaciones (Original y Copia) <span className="text-red-500">*</span>
                  </label>
                </div>
              </div>

              <div className="col-12 col-md-6 mb-3">
                <div className={`flex align-items-center gap-3 p-3 border-1 border-round ${formData.tipoIngreso === 'REINGRESO' ? 'surface-200 border-300' : 'surface-card surface-border'}`}>
                  <Checkbox
                    inputId="hojaTraslado"
                    checked={formData.requisitos.hojaTraslado}
                    disabled={formData.tipoIngreso === 'REINGRESO'}
                    onChange={(e) => handleRequisitoChange('hojaTraslado', e.checked)}
                  />
                  <label htmlFor="hojaTraslado" className="font-medium cursor-pointer">
                    4. Hoja de Traslado (Firmada y Sellada) {formData.tipoIngreso === 'REINGRESO' && '(No Aplica)'}
                  </label>
                </div>
              </div>

              <div className="col-12 col-md-6 mb-3">
                <div className={`flex align-items-center gap-3 p-3 border-1 border-round ${formData.tipoIngreso === 'REINGRESO' ? 'surface-200 border-300' : 'surface-card surface-border'}`}>
                  <Checkbox
                    inputId="constanciaConducta"
                    checked={formData.requisitos.constanciaConducta}
                    disabled={formData.tipoIngreso === 'REINGRESO'}
                    onChange={(e) => handleRequisitoChange('constanciaConducta', e.checked)}
                  />
                  <label htmlFor="constanciaConducta" className="font-medium cursor-pointer">
                    5. Constancia de Conducta {formData.tipoIngreso === 'REINGRESO' && '(En Archivo)'}
                  </label>
                </div>
              </div>

              <div className="col-12 col-md-6 mb-3">
                <div className={`flex align-items-center gap-3 p-3 border-1 border-round ${formData.tipoIngreso === 'REINGRESO' ? 'surface-200 border-300' : 'surface-card surface-border'}`}>
                  <Checkbox
                    inputId="dniTutores"
                    checked={formData.requisitos.dniTutores}
                    disabled={formData.tipoIngreso === 'REINGRESO'}
                    onChange={(e) => handleRequisitoChange('dniTutores', e.checked)}
                  />
                  <label htmlFor="dniTutores" className="font-medium cursor-pointer">
                    6. Fotocopia de Cédula / DNI de Tutores {formData.tipoIngreso === 'REINGRESO' && '(En Archivo)'}
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-content-between gap-2 mt-4">
              <Button label="Atrás" icon="pi pi-arrow-left" severity="secondary" outlined onClick={() => setActiveIndex(1)} />
              <Button
                label="Siguiente"
                icon="pi pi-arrow-right"
                iconPos="right"
                disabled={!isPaso2Valido}
                onClick={() => setActiveIndex(3)}
              />
            </div>
          </div>
          </div>

          <div
            aria-hidden={activeIndex !== 3}
            style={{
              gridArea: '1 / 1',
              visibility: activeIndex === 3 ? 'visible' : 'hidden'
            }}
          >
          <div className="p-fluid">
            <h5 className="font-bold text-700 mb-3">Paso 4: Solvencia de Matrícula y Finalización del Expediente</h5>

            <div className="grid">
              <div className="col-12 mb-3">
                <Card className="surface-card border-1 surface-border">
                  {estadoSolvencia === 'loading' && (
                    <div className="flex align-items-center gap-2">
                      <i className="pi pi-spin pi-spinner text-primary" aria-hidden="true" />
                      <span>Consultando pagos de matrícula del año {formData.anioLectivo}...</span>
                    </div>
                  )}
                  {estadoSolvencia === 'paid' && (
                    <div>
                      <Tag severity="success" value="MATRÍCULA CANCELADA" className="text-base p-2 mb-3" />
                      <p className="mb-0">
                        Todos los pagos de matrícula del estudiante para el año {formData.anioLectivo} están cancelados.
                      </p>
                    </div>
                  )}
                  {estadoSolvencia === 'pending' && (
                    <div>
                      <Tag severity="warning" value="MATRÍCULA PENDIENTE" className="text-base p-2 mb-3" />
                      <p className="mb-0">
                        No se puede guardar la matrícula hasta que todos los conceptos tengan estado CANCELADO.
                      </p>
                    </div>
                  )}
                  {estadoSolvencia === 'unpaid' && (
                    <div>
                      <Tag severity="warning" value="SIN PAGOS DE MATRÍCULA" className="text-base p-2 mb-3" />
                      <p className="mb-0">
                        El estudiante no ha realizado pagos de matrícula para el año {formData.anioLectivo}.
                      </p>
                    </div>
                  )}
                  {estadoSolvencia === 'error' && (
                    <div>
                      <Tag severity="danger" value="NO SE PUDO VERIFICAR LA SOLVENCIA" className="text-base p-2 mb-3" />
                      <p className="mb-0">{errorSolvencia}</p>
                    </div>
                  )}
                  {pagosMatricula.length > 0 && (
                    <div className="mt-3">
                      {pagosMatricula.map((pago, index) => {
                        const estado = String(pago.estado || 'DESCONOCIDO').trim().toUpperCase();
                        const severidad = estado === 'CANCELADO'
                          ? 'success'
                          : estado === 'PENDIENTE'
                            ? 'warning'
                            : 'secondary';

                        return (
                          <div
                            key={`${pago.idTarifa || pago.idPersona || 'pago'}-${index}`}
                            className="flex flex-wrap justify-content-between align-items-center gap-2 py-2 border-bottom-1 surface-border"
                          >
                            <span className="font-medium">{pago.arancel || `Tarifa ${pago.idTarifa || ''}`}</span>
                            <span>
                              Pagado: {Number(pago.totalPagado || 0).toFixed(2)}
                              {' · '}Saldo: {Number(pago.saldoPendiente || 0).toFixed(2)}
                            </span>
                            <Tag severity={severidad} value={estado} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>

            </div>

            {!matriculaCreada ? (
              <div className="text-center p-3">
                <i className="pi pi-check-square text-primary text-5xl mb-3" aria-hidden="true" />
                <h4 className="font-bold text-800 mb-2">Finalización del Expediente</h4>
                <p className="text-600 mb-4">
                  Se matriculará al estudiante para el Año Lectivo <strong>{formData.anioLectivo}</strong>.
                </p>
                <div className="flex justify-content-between gap-3">
                  <Button label="Atrás" icon="pi pi-arrow-left" severity="secondary" outlined onClick={() => setActiveIndex(2)} disabled={loadingGuardado} />
                  <Button
                    label="Guardar Matrícula"
                    icon="pi pi-save"
                    severity="success"
                    loading={loadingGuardado}
                    disabled={!puedeGuardarMatricula || !Number.isFinite(montoMatriculaPagado) || montoMatriculaPagado <= 0 || loadingGuardado}
                    onClick={handleGuardarMatricula}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center p-3">
                <i className="pi pi-check-circle text-green-500 text-6xl mb-3" aria-hidden="true" />
                <h3 className="font-bold text-900 mb-2">¡Matrícula Inscrita Exitosamente!</h3>
                <p className="text-700 mb-4">El expediente ha quedado procesado. Puede obtener la Ficha Oficial de Matrícula.</p>
                <div className="flex flex-column sm:flex-row justify-content-center gap-3">
                  <Button label="Imprimir Hoja Matrícula" icon="pi pi-print" onClick={handleDescargarPDF} />
                  <Button label="Limpiar" icon="pi pi-eraser" onClick={handleLimpiarMatricula} />
                  {onCancel && <Button label="Finalizar y Salir" icon="pi pi-times" severity="secondary" outlined onClick={onCancel} />}
                </div>
              </div>
            )}
              </div>
            </div>
          </div>

      </Card>
    </div>
  );
};

MatriculaScreenSteps.propTypes = {
  onSuccess: PropTypes.func,
  onCancel: PropTypes.func
};

export default MatriculaScreenSteps;  
