import React, { useEffect, useRef, useState } from 'react';

import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { Message } from 'primereact/message';
import { Toast } from 'primereact/toast';

import {
    getGrados,
    getCatalogoSalon,
    ServicioValidado
} from '../../../Servicios/SalonServicios/salonService';

// Opciones fijas de turno. Lo que se guarda en la base de datos es "value".
const OPCIONES_TURNO = [
    { label: 'Matutino', value: 'Matutino' },
    { label: 'Vespertino', value: 'Vespertino' }
];

// Estado inicial del formulario (también se usa para limpiarlo).
const SALON_INICIAL = {
    idGrado: null,
    idcatalogo_salon: null,
    turno: null,
    seccion: '',
    anioLectivo: ''
};

// Un valor es "vacío" si es null, undefined o texto en blanco.
const estaVacio = valor =>
    valor === null ||
    valor === undefined ||
    String(valor).trim() === '';

export default function Addsalon({
    cargarSalon,
    setEstudiantedoAdd
}) {
    const toast = useRef(null);

    const [grados, setGrados] = useState([]);
    const [catalogoSalones, setCatalogoSalones] = useState([]);

    const [loading, setLoading] = useState(false);
    const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const [salonInfo, setSalonInfo] = useState(SALON_INICIAL);

    // Cargar grados y catálogo de salones
    useEffect(() => {
        let activo = true;

        const cargarCatalogos = async () => {
            try {
                setCargandoCatalogos(true);
                setErrorMessage('');

                const [gradosData, catalogosData] =
                    await Promise.all([
                        getGrados(),
                        getCatalogoSalon()
                    ]);

                if (!activo) return;

                const listaGrados = Array.isArray(gradosData)
                    ? gradosData
                    : [];

                const listaCatalogos = Array.isArray(catalogosData)
                    ? catalogosData
                    : [];

                setGrados(
                    listaGrados.map(grado => ({
                        idGrado: grado.idGrado ?? grado.idgrado,
                        nombre: grado.nombre
                    }))
                );

                setCatalogoSalones(
                    listaCatalogos.map(catalogo => ({
                        idCatalogoSalon:
                            catalogo.idCatalogoSalon ??
                            catalogo.idcatalogo_salon ??
                            catalogo.idcatalogoSalon,
                        nombreSalon:
                            catalogo.nombreSalon ??
                            catalogo.nombre_salon
                    }))
                );

            } catch (error) {
                console.error('Error al cargar catálogos:', error);

                if (activo) {
                    setErrorMessage(
                        'No se pudieron cargar los grados y salones del catálogo.'
                    );
                }
            } finally {
                if (activo) {
                    setCargandoCatalogos(false);
                }
            }
        };

        cargarCatalogos();

        return () => {
            activo = false;
        };
    }, []);

    // Actualizar campos
    const handleChange = (campo, valor) => {
        setSalonInfo(prev => ({
            ...prev,
            [campo]: valor
        }));

        setErrorMessage('');
    };

    // Validar y registrar
    const AddSalonData = async (e) => {
        e.preventDefault();
        setErrorMessage('');

        if (
            estaVacio(salonInfo.idGrado) ||
            estaVacio(salonInfo.idcatalogo_salon) ||
            estaVacio(salonInfo.turno) ||
            estaVacio(salonInfo.seccion) ||
            estaVacio(salonInfo.anioLectivo)
        ) {
            setErrorMessage(
                'Todos los campos marcados con * son obligatorios.'
            );
            return;
        }

        // El turno solo puede ser una de las opciones del Dropdown.
        if (!OPCIONES_TURNO.some(op => op.value === salonInfo.turno)) {
            setErrorMessage('Seleccione un turno válido: Matutino o Vespertino.');
            return;
        }

        const payload = {
            grado: {
                idGrado: Number(salonInfo.idGrado)
            },
            catalogoSalon: {
                idCatalogoSalon: Number(salonInfo.idcatalogo_salon)
            },
            turno: salonInfo.turno,
            seccion: salonInfo.seccion.trim(),
            anioLectivo: salonInfo.anioLectivo.trim()
        };

        try {
            setLoading(true);

            await ServicioValidado(payload);

            toast.current?.show({
                severity: 'success',
                summary: 'Registro exitoso',
                detail: 'El salón se registró correctamente.',
                life: 3000
            });

            setSalonInfo(SALON_INICIAL);

            if (typeof cargarSalon === 'function') {
                await cargarSalon();
            }

            if (typeof setEstudiantedoAdd === 'function') {
                setEstudiantedoAdd();
            }

        } catch (error) {
            // 1. Extraemos los datos del error que envía Axios
            const errorData = error.response?.data;

            // 2. Accedemos directamente a las propiedades de tu JSON (detail o title)
            const mensaje =
                errorData?.detail ||
                errorData?.title ||
                error.message ||
                'No se pudo registrar el salón.';

            console.error('Error al registrar salón:', mensaje);
            setErrorMessage(mensaje);

            toast.current?.show({
                severity: 'error',
                summary: 'Error al guardar',
                detail: mensaje,
                life: 4000
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-3">
            <Toast ref={toast} />

            <h2 className="text-xl mb-4">Asignar salón</h2>

            {errorMessage && (
                <Message
                    severity="error"
                    text={errorMessage}
                    className="w-full mb-3"
                />
            )}

            {cargandoCatalogos ? (
                <div className="flex align-items-center gap-2">
                    <i className="pi pi-spin pi-spinner" />
                    <span>Cargando grados y salones...</span>
                </div>
            ) : (
                <form onSubmit={AddSalonData}>
                    <div className="grid">

                        {/* Grado */}
                        <div className="col-12 md:col-6">
                            <label className="block mb-2">
                                Grado *
                            </label>

                            <Dropdown
                                value={salonInfo.idGrado}
                                options={grados}
                                optionLabel="nombre"
                                optionValue="idGrado"
                                onChange={(e) =>
                                    handleChange('idGrado', e.value)
                                }
                                placeholder="Seleccione un grado"
                                className="w-full"
                                filter
                                showClear
                                disabled={loading}
                            />
                        </div>

                        {/* Catálogo de salón */}
                        <div className="col-12 md:col-6">
                            <label className="block mb-2">
                                Nombre del salón *
                            </label>

                            <Dropdown
                                value={salonInfo.idcatalogo_salon}
                                options={catalogoSalones}
                                optionLabel="nombreSalon"
                                optionValue="idCatalogoSalon"
                                onChange={(e) =>
                                    handleChange(
                                        'idcatalogo_salon',
                                        e.value
                                    )
                                }
                                placeholder="Seleccione un salón"
                                className="w-full"
                                filter
                                showClear
                                disabled={loading}
                            />
                        </div>

                        {/* Turno: Mañana o Tarde */}
                        <div className="col-12 md:col-6">
                            <label className="block mb-2">
                                Turno *
                            </label>

                            <Dropdown
                                value={salonInfo.turno}
                                options={OPCIONES_TURNO}
                                optionLabel="label"
                                optionValue="value"
                                onChange={(e) =>
                                    handleChange('turno', e.value)
                                }
                                placeholder="Seleccione un turno"
                                className="w-full"
                                showClear
                                disabled={loading}
                            />
                        </div>

                        {/* Sección */}
                        <div className="col-12 md:col-6">
                            <label className="block mb-2">
                                Sección *
                            </label>

                            <InputText
                                value={salonInfo.seccion}
                                onChange={(e) =>
                                    handleChange('seccion', e.target.value)
                                }
                                placeholder="Ej. A"
                                className="w-full"
                                maxLength={30}
                                disabled={loading}
                            />
                        </div>

                        {/* Año lectivo */}
                        <div className="col-12 md:col-6">
                            <label className="block mb-2">
                                Año lectivo *
                            </label>

                            <InputText
                                value={salonInfo.anioLectivo}
                                onChange={(e) =>
                                    handleChange(
                                        'anioLectivo',
                                        e.target.value
                                    )
                                }
                                placeholder="Ej. 2027"
                                className="w-full"
                                maxLength={10}
                                disabled={loading}
                            />
                        </div>

                        {/* Botones */}
                        <div className="col-12 flex justify-content-end gap-2 mt-3">
                            <Button
                                type="button"
                                label="Cancelar"
                                icon="pi pi-times"
                                severity="secondary"
                                outlined
                                disabled={loading}
                                onClick={setEstudiantedoAdd}
                            />

                            <Button
                                type="submit"
                                label={loading ? 'Guardando...' : 'Guardar'}
                                icon="pi pi-check"
                                severity="success"
                                loading={loading}
                                disabled={loading || cargandoCatalogos}
                            />
                        </div>
                    </div>
                </form>
            )}
        </div>
    );
}
