import api from '../../Servicios/api/api';


/**
 * Busca estudiantes por código, nombre o apellido.
 * @param {string} search - Término de búsqueda.
 * @returns {Promise<Array>}
 */
export const buscarEstudiantesMatricula = async (search) => {
  if (!search || !search.trim()) return [];
  const { data } = await api.get('/estudiante-app/estudiantes/buscar', {
    params: { search: search.trim() },
  });
  return Array.isArray(data) ? data : [];
};

export const buscarSeccionesPorGrado = async (idGrado) => {
  if (!idGrado) throw new Error('Debe seleccionar un grado para buscar sus secciones.');

  const { data } = await api.get(
    `/estudiante-app/salones/secciones/${encodeURIComponent(idGrado)}`
  );
  return Array.isArray(data) ? data : [];
};

/**
 * Solicita la generación y descarga del boletín académico en PDF
 * POST /reportes/descargar (Proxy a Jaspersoft API v2)
 * 
 * @param {Object} payload 
 * @param {number|string} payload.anioLectivo - Año lectivo (panio_lectivo)
 * @param {number|string} payload.idPersona - ID de la persona (pidpersona)
 * @param {number|string} payload.idGrado - ID del grado para boletín masivo (pidgrado)
 * @param {string} payload.seccion - Sección del grado para boletín masivo (pseccion)
 * @param {string} payload.codigoMined - Código MINED (pcodigo_mined)
 * @param {'parcial'|'final'} payload.tipoReporte - Tipo de boletín a generar
 * @param {'individual'|'masivo'} payload.modalidad - Alcance del reporte
 * @param {number|string} payload.numeroPeriodo - Período requerido por el boletín parcial
 * @returns {Promise<Blob>}
 */
export const descargarBoletin = async ({
  anioLectivo,
  idPersona,
  idGrado,
  seccion,
  codigoMined,
  tipoReporte = 'final',
  modalidad = 'individual',
  numeroPeriodo,
}) => {
  try {
    const esParcial = tipoReporte === 'parcial';
    if (
      modalidad === 'masivo' &&
      (idGrado === null || idGrado === undefined || idGrado === '')
    ) {
      throw new Error('Debe seleccionar un grado para generar los boletines.');
    }
    if (modalidad === 'masivo' && !String(seccion || '').trim()) {
      throw new Error('Debe seleccionar una sección para generar los boletines.');
    }

    const parametros = {
      panio_lectivo: anioLectivo ? Number(anioLectivo) : null,
    };

    if (modalidad === 'masivo') {
      parametros.pgrado = Number(idGrado);
      parametros.pseccion = String(seccion).trim();
    } else {
      parametros.pidpersona = idPersona ? Number(idPersona) : null;
      parametros.pcodigo_mined = codigoMined ? codigoMined.trim() : '';
    }

    if (esParcial && modalidad === 'individual') {
      parametros.pnumero_periodo = numeroPeriodo ? Number(numeroPeriodo) : null;
    }

    const response = await api.post(
      '/reportes/descargar',
      {
        nombrePlantilla:
          modalidad === 'masivo' || !esParcial
            ? 'Boletin_Silviano_final'
            : 'Boletin_Individual_Silviano',
        formato: 'PDF',
        parametros,
      },
      {
        responseType: 'blob',
      }
    );

    // Creación dinámica y descarga limpia del archivo PDF
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const identificador =
      modalidad === 'masivo'
        ? `grado_${idGrado}_seccion_${seccion}`
        : codigoMined || idPersona || 'estudiante';
    link.setAttribute('download', `Boletin_Silviano_${identificador}_${anioLectivo}.pdf`);

    document.body.appendChild(link);
    link.click();

    // Limpieza de memoria en el DOM
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);

    return response.data;
  } catch (error) {
    const responseData = error.response?.data;
    let mensajeBackend;

    if (responseData instanceof Blob) {
      const responseText = await responseData.text();
      try {
        const errorData = JSON.parse(responseText);
        mensajeBackend = errorData.message || errorData.mensaje;
      } catch {
        mensajeBackend = responseText;
      }
    } else if (typeof responseData === 'string') {
      mensajeBackend = responseData;
    } else {
      mensajeBackend = responseData?.message || responseData?.mensaje;
    }

    throw new Error(mensajeBackend || error.message || 'No se pudo generar el PDF del boletín.');
  }
};
/*
export const reportesService = {

  descargarBoletin: async (codigoMined, periodoLectivo, formato = 'pdf') => {
    try {
      const response = await api.get('/reportes/descargar', {
        params: { codigoMined, periodoLectivo, formato },
        responseType: 'blob', // Imprescindible para manejar binarios desde Jaspersoft
      });

      // Creación del Blob y enlace temporal de descarga
      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/pdf',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `Boletin_${codigoMined}_${periodoLectivo}.${formato}`);
      
      document.body.appendChild(link);
      link.click();

      // Limpieza inmediata de recursos de memoria
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      throw new Error('No se pudo generar el reporte desde el servidor de Jaspersoft.');
    }
  },
};*/