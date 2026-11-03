import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { Fieldset } from 'primereact/fieldset';

import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { getAsignaturas, deleteAsignatura } from '../../../Servicios/AsignaturaService/asignaturasService';
import AddAsignatura from '../../../Servicios/AsignaturaService/agregarAsignatura';
//import VerAsignatura from '../../../Servicios/DocenteServicios/VerAsignaturas';
import UpdateAsignatura from '../../../Servicios/AsignaturaService/EditarAsignaturas';
//import BuscarDocente from '../../../Servicios/DocenteServicios/BuscarAsignaturas';

// Minúsculas y sin tildes: "Matemática" -> "matematica".
const normalizar = (texto = '') =>
    String(texto ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

// Busca solo por nombre y código de la asignatura.
const filtrarAsignaturas = (asignaturas, busqueda) => {
    const q = normalizar(busqueda);

    if (!q) return asignaturas;

    return asignaturas.filter(asignatura =>
        [asignatura.nombre, asignatura.codigo].some(campo =>
            normalizar(campo).includes(q)
        )
    );
};

export default function Asignaturas() {

    const toast = useRef(null);

    const [showViewMode, setShowViewMode] = useState(false);
    const [showAddMode, setShowAddMode] = useState(false);
    const [showEditMode, setShowEditMode] = useState(false);

    const [asignaturas, setAsignaturas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedAsignaturateId, setSelectedAsignatturaId] = useState(null);

    const [busqueda, setBusqueda] = useState('');
    const [primeraFila, setPrimeraFila] = useState(0);

    // Asignaturas que se muestran según lo escrito en la barra de búsqueda.
    const asignaturasFiltradas = useMemo(
        () => filtrarAsignaturas(asignaturas, busqueda),
        [asignaturas, busqueda]
    );

    const cambiarBusqueda = valor => {
        setBusqueda(valor);
        setPrimeraFila(0); // vuelve a la página 1 al buscar
    };

    const cargarAsignaturas = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getAsignaturas();
            setAsignaturas(Array.isArray(data) ? data : []);
        } catch (error) {
            toast.current?.show({
                severity: 'error',
                summary: 'Error de Red',
                detail: 'No se pudo cargar la lista de asignaturas.',
                life: 4000
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        cargarAsignaturas();
    }, [cargarAsignaturas]);

    const handleConfirmDelete = (idAsignatura) => {
        confirmDialog({
            message: '¿Está seguro de eliminar este expediente de Asignatura?',
            header: 'Confirmar Eliminación',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            acceptLabel: 'Sí, Eliminar',
            rejectLabel: 'Cancelar',
            accept: async () => {
                try {
                    await deleteAsignatura(idAsignatura);
                    toast.current?.show({
                        severity: 'success',
                        summary: 'Registro Eliminado',
                        detail: 'El asignatura ha sido removido del sistema.',
                        life: 3000
                    });
                    cargarAsignaturas();
                } catch (error) {
                    toast.current?.show({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se logró eliminar el registro seleccionado.',
                        life: 4000
                    });
                }
            }
        });
    };

    const actionsBodyTemplate = (rowData) => {
        return (
            <div className="flex gap-2 justify-content-center">
                <Button
                    icon="pi pi-eye"
                    severity="info"
                    rounded
                    outlined
                    //tooltip="Ver Expediente"
                    tooltipOptions={{ position: 'top' }}
                    onClick={() => {
                        setSelectedAsignatturaId(rowData.idAsignatura);
                        setShowViewMode(true);
                    }}
                />
                <Button
                    icon="pi pi-pencil"
                    severity="warning"
                    rounded
                    outlined

                    tooltipOptions={{ position: 'top' }}
                    onClick={() => {
                        setSelectedAsignatturaId(rowData.idAsignatura);
                        setShowEditMode(true);
                    }}
                />
                <Button
                    icon="pi pi-trash"
                    severity="danger"
                    rounded
                    outlined
                    //tooltip="Eliminar"
                    tooltipOptions={{ position: 'top' }}
                    onClick={() => handleConfirmDelete(rowData.idAsignatura)}
                />

            </div>
        );
    };

    // =========================================================
    // BARRA DE BÚSQUEDA GRANDE (centrada, estilo buscador)
    // Busca por nombre y código de la asignatura.
    // =========================================================

    const barraBusqueda = (
        <div className="flex flex-column align-items-center mb-4">
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '720px'
                }}
            >
                <i
                    className="pi pi-search"
                    style={{
                        position: 'absolute',
                        left: '1rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#6b7280',
                        fontSize: '1.1rem',
                        pointerEvents: 'none'
                    }}
                />

                <input
                    type="text"
                    value={busqueda}
                    onChange={e => cambiarBusqueda(e.target.value)}
                    placeholder="Buscar por nombre o código de la asignatura..."
                    aria-label="Buscar asignaturas"
                    style={{
                        width: '100%',
                        height: '3.25rem',
                        padding: '0 3rem 0 2.75rem',
                        fontSize: '1rem',
                        fontWeight: 600,
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        outline: 'none',
                        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
                        boxSizing: 'border-box'
                    }}
                />

                {busqueda && (
                    <button
                        type="button"
                        onClick={() => cambiarBusqueda('')}
                        aria-label="Limpiar búsqueda"
                        style={{
                            position: 'absolute',
                            right: '0.75rem',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: '#6b7280',
                            fontSize: '1rem'
                        }}
                    >
                        <i className="pi pi-times" />
                    </button>
                )}
            </div>

            {busqueda.trim() && (
                <small className="mt-2 text-600">
                    {asignaturasFiltradas.length}{' '}
                    {asignaturasFiltradas.length === 1
                        ? 'resultado'
                        : 'resultados'}
                </small>
            )}
        </div>
    );

    return (
        <div className="p-3 md:p-4">
            <Toast ref={toast} />
            <ConfirmDialog />

            <Card title="Expedientes de Asignaturas - SIGE">

                {barraBusqueda}

                <DataTable

                    value={asignaturasFiltradas}
                    paginator
                    rows={10}
                    first={primeraFila}
                    onPage={e => setPrimeraFila(e.first)}
                    paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
                    dataKey="idAsignatura"
                    stripedRows
                    loading={loading}
                    emptyMessage={
                        busqueda.trim()
                            ? 'No se encontraron asignaturas con esa búsqueda.'
                            : 'No se encontraron registros de asignaturas.'
                    }
                    responsiveLayout="scroll"
                >
                    <Column field="nombre" header="Nombre" sortable style={{ minWidth: '10rem' }} />
                    <Column field="codigo" header="Codigo" sortable style={{ minWidth: '8rem' }} />
                    <Column header="Acciones" body={actionsBodyTemplate} exportable={false} style={{ minWidth: '10rem', textAlign: 'center' }} />
                </DataTable>

                {/* Sección de acciones inferior dentro del Fieldset */}
                <Fieldset legend="Acciones" className="mt-4">
                    <div className="flex flex-wrap gap-3 align-items-center">
                        <Button
                            label="Nueva Asignatura"
                            icon="pi pi-plus"
                            severity="primary"
                            onClick={() => setShowAddMode(true)}
                        />

                    </div>
                </Fieldset>
            </Card>

            {/* Modal Agregar Asignatura */}
            <Dialog
                header="Registrar Nuevo Asignatura"
                visible={showAddMode}
                style={{ width: '90vw', maxWidth: '850px' }}
                onHide={() => setShowAddMode(false)}

            >
                <AddAsignatura
                    cargarAsignatura={cargarAsignaturas}
                    setAsignaturaAdd={() => setShowAddMode(false)}
                />
            </Dialog>

            {/* Modal Editar Asignatura */}
            <Dialog
                header="Editar Expediente de Asignatura"
                visible={showEditMode}
                style={{ width: '90vw', maxWidth: '850px' }}
                onHide={() => {
                    setShowEditMode(false);
                    setSelectedAsignatturaId(null);
                }}

            >
                {selectedAsignaturateId && (
                    <UpdateAsignatura
                        idAsignatura={selectedAsignaturateId}
                        onAsignaturaUpdate={() => {
                            setShowEditMode(false);
                            setSelectedAsignatturaId(null);
                            cargarAsignaturas();
                        }}
                    />
                )}
            </Dialog>
        </div>
    );

}
