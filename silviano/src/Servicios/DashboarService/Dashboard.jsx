import React, { useCallback, useEffect, useState } from 'react';

import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Chart } from 'primereact/chart';
import { Message } from 'primereact/message';
import { ProgressSpinner } from 'primereact/progressspinner';

import 'chart.js/auto';
import './Dashboard.css';

import {
    obtenerResumenDashboard,
    obtenerMejoresPromediosPrimaria,
    obtenerMejoresPromediosSecundaria
} from './dashboardService.js';


const Dashboard = () => {

    // ==========================================
    // ESTADOS
    // ==========================================

    const [resumen, setResumen] = useState({
        estudiantes: 0,
        docentes: 0,
        grados: 0,
        asignaturas: 0,
        tutores: 0,
        salones: 0,
        activos: 0,
        inactivos: 0,
        matriculados: 0
    });

    const [mejoresPrimaria, setMejoresPrimaria] = useState([]);
    const [mejoresSecundaria, setMejoresSecundaria] = useState([]);

    const [cargando, setCargando] = useState(false);
    const [errorResumen, setErrorResumen] = useState('');
    const [errorPrimaria, setErrorPrimaria] = useState('');
    const [errorSecundaria, setErrorSecundaria] = useState('');

    const anioActual = new Date().getFullYear();


    // ==========================================
    // CARGAR DATOS DEL DASHBOARD
    // ==========================================

    const cargarDatosDashboard = useCallback(async () => {

        setCargando(true);

        setErrorResumen('');
        setErrorPrimaria('');
        setErrorSecundaria('');

        const resultados = await Promise.allSettled([
            obtenerResumenDashboard(),
            obtenerMejoresPromediosPrimaria(),
            obtenerMejoresPromediosSecundaria()
        ]);

        // RESUMEN GENERAL
        if (resultados[0].status === 'fulfilled') {

            setResumen({
                estudiantes: resultados[0].value?.estudiantes ?? 0,
                docentes: resultados[0].value?.docentes ?? 0,
                grados: resultados[0].value?.grados ?? 0,
                asignaturas: resultados[0].value?.asignaturas ?? 0,
                tutores: resultados[0].value?.tutores ?? 0,
                salones: resultados[0].value?.salones ?? 0,
                activos: resultados[0].value?.activos ?? 0,
                inactivos: resultados[0].value?.inactivos ?? 0,
                matriculados: resultados[0].value?.matriculados ?? 0
            });

        } else {

            console.error(
                'Error al cargar el resumen:',
                resultados[0].reason
            );

            setErrorResumen(
                'No fue posible cargar el resumen general.'
            );
        }

        
        // MEJORES PROMEDIOS PRIMARIA
        if (resultados[1].status === 'fulfilled') {

            const datos = resultados[1].value;

            setMejoresPrimaria(
                Array.isArray(datos) ? datos : []
            );

        } else {

            console.error(
                'Error al cargar promedios de Primaria:',
                resultados[1].reason
            );

            setMejoresPrimaria([]);

            setErrorPrimaria(
                'No fue posible cargar los promedios de Primaria.'
            );
        }


        // MEJORES PROMEDIOS SECUNDARIA
        if (resultados[2].status === 'fulfilled') {

            const datos = resultados[2].value;

            setMejoresSecundaria(
                Array.isArray(datos) ? datos : []
            );

        } else {

            console.error(
                'Error al cargar promedios de Secundaria:',
                resultados[2].reason
            );

            setMejoresSecundaria([]);

            setErrorSecundaria(
                'No fue posible cargar los promedios de Secundaria.'
            );
        }

        setCargando(false);

    }, []);


    // ==========================================
    // CARGAR AL ENTRAR AL DASHBOARD
    // ==========================================

    useEffect(() => {
        cargarDatosDashboard();
    }, [cargarDatosDashboard]);


    // ==========================================
    // TARJETAS DEL RESUMEN GENERAL
    // ==========================================

    const tarjetasGenerales = [
        {
            titulo: 'Estudiantes',
            valor: resumen.estudiantes,
            icono: 'pi pi-users',
            color: 'turquesa'
        },
        {
            titulo: 'Docentes',
            valor: resumen.docentes,
            icono: 'pi pi-id-card',
            color: 'azul'
        },
        {
            titulo: 'Grados',
            valor: resumen.grados,
            icono: 'pi pi-graduation-cap',
            color: 'morado'
        },
        {
            titulo: 'Asignaturas',
            valor: resumen.asignaturas,
            icono: 'pi pi-book',
            color: 'naranja'
        },
        {
            titulo: 'Tutores',
            valor: resumen.tutores,
            icono: 'pi pi-user',
            color: 'rosa'
        },
        {
            titulo: 'Salones',
            valor: resumen.salones,
            icono: 'pi pi-building',
            color: 'celeste'
        }
    ];


    // ==========================================
    // TARJETAS DE ESTADO
    // ==========================================

    const tarjetasEstado = [
        {
            titulo: 'Estudiantes activos',
            valor: resumen.activos,
            icono: 'pi pi-check-circle',
            color: 'verde',
            descripcion: 'Según su estado actual'
        },
        {
            titulo: 'Estudiantes inactivos',
            valor: resumen.inactivos,
            icono: 'pi pi-times-circle',
            color: 'rojo',
            descripcion: 'Según su estado actual'
        },
        {
            titulo: `Matriculados ${anioActual}`,
            valor: resumen.matriculados,
            icono: 'pi pi-file',
            color: 'morado',
            descripcion: `Año lectivo ${anioActual}`
        }
    ];


    // ==========================================
    // GRÁFICO DE BARRAS
    // ==========================================

    const datosBarras = {
        labels: [
            'Activos',
            'Inactivos',
            `Matriculados ${anioActual}`
        ],
        datasets: [
            {
                label: 'Cantidad de estudiantes',
                data: [
                    resumen.activos,
                    resumen.inactivos,
                    resumen.matriculados
                ],
                backgroundColor: [
                    '#16a34a',
                    '#dc2626',
                    '#9333ea'
                ],
                borderRadius: 5,
                barThickness: 65
            }
        ]
    };

    const opcionesBarras = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom'
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0
                },
                title: {
                    display: true,
                    text: 'Cantidad de estudiantes'
                }
            }
        }
    };


    // ==========================================
    // DATOS DE GRÁFICOS CIRCULARES
    // ==========================================

    const coloresPastel = [
        '#2196f3',
        '#16a34a',
        '#ff9800',
        '#8b5cf6',
        '#ec4899'
    ];

    const crearDatosPastel = (estudiantes) => {

        const primerosCinco = estudiantes.slice(0, 5);

        return {
            labels: primerosCinco.map(
                item => item.nombreCompleto
            ),
            datasets: [
                {
                    data: primerosCinco.map(
                        item => Number(item.promedio)
                    ),
                    backgroundColor: coloresPastel,
                    borderColor: '#ffffff',
                    borderWidth: 2
                }
            ]
        };
    };

    const opcionesPastel = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: (context) => {
                        return `${context.label}: ${Number(
                            context.raw
                        ).toFixed(2)}`;
                    }
                }
            }
        }
    };


    // ==========================================
    // PANEL DE MEJORES PROMEDIOS
    // ==========================================

    const renderPanelPromedios = (
        titulo,
        estudiantes,
        error
    ) => {

        const primerosCinco = estudiantes.slice(0, 5);

        return (
            <Card className="dashboard-chart-card dashboard-pie-card">

                <div className="chart-header">
                    <h3>{titulo}</h3>
                    <span>Top 5 de estudiantes</span>
                </div>

                {error ? (

                    <div className="chart-empty">
                        <Message
                            severity="warn"
                            text={error}
                        />
                    </div>

                ) : primerosCinco.length > 0 ? (

                    <div className="pie-content">

                        <div className="pie-chart-container">
                            <Chart
                                type="pie"
                                data={crearDatosPastel(primerosCinco)}
                                options={opcionesPastel}
                            />
                        </div>

                        <div className="pie-legend">

                            {primerosCinco.map((item, index) => (

                                <div
                                    className="pie-legend-item"
                                    key={`${item.nombreCompleto}-${index}`}
                                >

                                    <span
                                        className="legend-dot"
                                        style={{
                                            backgroundColor:
                                                coloresPastel[index]
                                        }}
                                    />

                                    <span className="legend-name">
                                        {index + 1}. {item.nombreCompleto}
                                    </span>

                                    <strong>
                                        {Number(item.promedio).toFixed(1)}
                                    </strong>

                                </div>

                            ))}

                        </div>

                    </div>

                ) : (

                    <div className="chart-empty">
                        No hay calificaciones disponibles.
                    </div>

                )}

            </Card>
        );
    };


    // ==========================================
    // VISTA PRINCIPAL
    // ==========================================

    return (

        <main className="dashboard-container">

            {/* ENCABEZADO */}

            <div className="dashboard-header">

                <div>
                    <h1>Dashboard académico</h1>

                    <p>
                        Bienvenido al Sistema Académico del
                        Colegio Silviano Matamoros
                    </p>
                </div>

                <Button
                    label="Actualizar"
                    icon="pi pi-refresh"
                    outlined
                    loading={cargando}
                    onClick={cargarDatosDashboard}
                />

            </div>


            {/* INDICADOR DE CARGA */}

            {cargando && (
                <div className="dashboard-loading">
                    <ProgressSpinner
                        style={{
                            width: '35px',
                            height: '35px'
                        }}
                        strokeWidth="5"
                    />
                    <span>Cargando información...</span>
                </div>
            )}


            {/* ERROR DEL RESUMEN */}

            {errorResumen && (
                <Message
                    severity="error"
                    text={errorResumen}
                    className="dashboard-error"
                />
            )}


            {/* RESUMEN GENERAL */}

            <Card className="dashboard-section-card">

                <div className="section-title">
                    <h2>Resumen general</h2>
                    <span>Indicadores del sistema</span>
                </div>

                <div className="dashboard-general-grid">

                    {tarjetasGenerales.map((item, index) => (

                        <div
                            className="dashboard-info-card"
                            key={index}
                        >

                            <div className={`dashboard-icon ${item.color}`}>
                                <i className={item.icono}></i>
                            </div>

                            <div className="dashboard-info">
                                <span>{item.titulo}</span>
                                <strong>{item.valor}</strong>
                            </div>

                            <i className="pi pi-angle-right card-arrow"></i>

                        </div>

                    ))}

                </div>

            </Card>


            {/* ESTADO DE LOS ESTUDIANTES */}

            <Card className="dashboard-section-card">

                <div className="section-title">
                    <h2>Estado de los estudiantes</h2>
                    <span>Según su estado actual</span>
                </div>

                <div className="dashboard-status-grid">

                    {tarjetasEstado.map((item, index) => (

                        <div
                            className="dashboard-info-card status-card"
                            key={index}
                        >

                            <div className={`dashboard-icon ${item.color}`}>
                                <i className={item.icono}></i>
                            </div>

                            <div className="dashboard-info">
                                <span>{item.titulo}</span>
                                <strong>{item.valor}</strong>
                                <small>{item.descripcion}</small>
                            </div>

                            <i className="pi pi-angle-right card-arrow"></i>

                        </div>

                    ))}

                </div>

            </Card>


            {/* GRÁFICOS */}

            <section className="dashboard-analytics-grid">

                {/* GRÁFICO DE BARRAS */}

                <Card className="dashboard-chart-card dashboard-bar-card">

                    <div className="chart-header">
                        <h3>Comparación de estudiantes</h3>

                        <span>
                            Activos, inactivos y matriculados durante {anioActual}
                        </span>
                    </div>

                    <div className="bar-chart-container">

                        <Chart
                            type="bar"
                            data={datosBarras}
                            options={opcionesBarras}
                        />

                    </div>

                </Card>


                {/* MEJORES PROMEDIOS DE PRIMARIA 

                {renderPanelPromedios(
                    'Mejores promedios de Primaria',
                    mejoresPrimaria,
                    errorPrimaria
                )}


                 MEJORES PROMEDIOS DE SECUNDARIA 

                {renderPanelPromedios(
                    'Mejores promedios de Secundaria',
                    mejoresSecundaria,
                    errorSecundaria
                )} */}

            </section>

        </main>

    );
};

export default Dashboard;
