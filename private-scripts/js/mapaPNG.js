

// 

const MAPAPNG_CONFIG = {
    basePath: './web_data_NE/tempestes/',

    geojsonPaths: [
        './dades_pngs/comarques.geojson',
    ],
    
    // ═══ TOTES LES VARIABLES (2D + 3D) ═══
    variables: {
        // ═══ 2D — Tempestes ═══
        CAPE_INS__GROUND: {
            nom: 'CAPE',
            prefix: 'CAPE_INS__GROUND',
            unitat: 'J/kg',
            carpeta: 'CAPE_INS__GROUND'
        },
        MLCAPE__GROUND: {
            nom: 'MLCAPE',
            prefix: 'MLCAPE__GROUND',
            unitat: 'J/kg',
            carpeta: 'MLCAPE__GROUND'
        },
        CIN__GROUND: {
            nom: 'CIN',
            prefix: 'CIN__GROUND',
            unitat: 'J/kg',
            carpeta: 'CIN__GROUND'
        },
        DIAG_EHI__GROUND: {
            nom: 'EHI',
            prefix: 'DIAG_EHI__GROUND',
            unitat: '',
            carpeta: 'DIAG_EHI__GROUND'
        },
        COLONNE_VAPO__GROUND: {
            nom: 'Vapor d\'aigua',
            prefix: 'COLONNE_VAPO__GROUND',
            unitat: 'kg/m²',
            carpeta: 'COLONNE_VAPO__GROUND'
        },
        ALTITUDE__GROUND: {
            nom: 'Altitud',
            prefix: 'ALTITUDE__GROUND',
            unitat: 'm',
            carpeta: 'ALTITUDE__GROUND'
        },

        // ═══ 3D — Temperatura ═══
        T_925: {
            nom: 'Temperatura 925hPa',
            prefix: 'T__ISOBARIC_925',
            unitat: '°C',
            carpeta: 'T__ISOBARIC_925'
        },
        T_850: {
            nom: 'Temperatura 850hPa',
            prefix: 'T__ISOBARIC_850',
            unitat: '°C',
            carpeta: 'T__ISOBARIC_850'
        },
        T_700: {
            nom: 'Temperatura 700hPa',
            prefix: 'T__ISOBARIC_700',
            unitat: '°C',
            carpeta: 'T__ISOBARIC_700'
        },
        T_500: {
            nom: 'Temperatura 500hPa',
            prefix: 'T__ISOBARIC_500',
            unitat: '°C',
            carpeta: 'T__ISOBARIC_500'
        },

        // ═══ 3D — Temp. adiabàtica ═══
        TA_850: {
            nom: 'Temp. adiabàtica 850hPa',
            prefix: 'TA__ISOBARIC_850',
            unitat: 'K',
            carpeta: 'TA__ISOBARIC_850'
        },
        TA_700: {
            nom: 'Temp. adiabàtica 700hPa',
            prefix: 'TA__ISOBARIC_700',
            unitat: 'K',
            carpeta: 'TA__ISOBARIC_700'
        },
        TA_500: {
            nom: 'Temp. adiabàtica 500hPa',
            prefix: 'TA__ISOBARIC_500',
            unitat: 'K',
            carpeta: 'TA__ISOBARIC_500'
        },

        // ═══ 3D — Temp. bulb humit ═══
        TB_850: {
            nom: 'Temp. bulb humit 850hPa',
            prefix: 'TB__ISOBARIC_850',
            unitat: 'K',
            carpeta: 'TB__ISOBARIC_850'
        },
        TB_700: {
            nom: 'Temp. bulb humit 700hPa',
            prefix: 'TB__ISOBARIC_700',
            unitat: 'K',
            carpeta: 'TB__ISOBARIC_700'
        },
        TB_500: {
            nom: 'Temp. bulb humit 500hPa',
            prefix: 'TB__ISOBARIC_500',
            unitat: 'K',
            carpeta: 'TB__ISOBARIC_500'
        },

        // ═══ 3D — Temp. potencial ═══
        THETA_850: {
            nom: 'Temp. potencial 850hPa',
            prefix: 'THETA__ISOBARIC_850',
            unitat: 'K',
            carpeta: 'THETA__ISOBARIC_850'
        },
        THETA_700: {
            nom: 'Temp. potencial 700hPa',
            prefix: 'THETA__ISOBARIC_700',
            unitat: 'K',
            carpeta: 'THETA__ISOBARIC_700'
        },
        THETA_500: {
            nom: 'Temp. potencial 500hPa',
            prefix: 'THETA__ISOBARIC_500',
            unitat: 'K',
            carpeta: 'THETA__ISOBARIC_500'
        },

        // ═══ 3D — Temp. potencial virtual ═══
        THETAV_925: {
            nom: 'Theta virtual 925hPa',
            prefix: 'THETAV__ISOBARIC_925',
            unitat: 'K',
            carpeta: 'THETAV__ISOBARIC_925'
        },
        THETAV_850: {
            nom: 'Theta virtual 850hPa',
            prefix: 'THETAV__ISOBARIC_850',
            unitat: 'K',
            carpeta: 'THETAV__ISOBARIC_850'
        },
        THETAV_700: {
            nom: 'Theta virtual 700hPa',
            prefix: 'THETAV__ISOBARIC_700',
            unitat: 'K',
            carpeta: 'THETAV__ISOBARIC_700'
        },

        // ═══ 3D — Vent U ═══
        U_925: {
            nom: 'Vent U 925hPa',
            prefix: 'U__ISOBARIC_925',
            unitat: 'm/s',
            carpeta: 'U__ISOBARIC_925'
        },
        U_850: {
            nom: 'Vent U 850hPa',
            prefix: 'U__ISOBARIC_850',
            unitat: 'm/s',
            carpeta: 'U__ISOBARIC_850'
        },
        U_700: {
            nom: 'Vent U 700hPa',
            prefix: 'U__ISOBARIC_700',
            unitat: 'm/s',
            carpeta: 'U__ISOBARIC_700'
        },

        // ═══ 3D — Vent V ═══
        V_850: {
            nom: 'Vent V 850hPa',
            prefix: 'V__ISOBARIC_850',
            unitat: 'm/s',
            carpeta: 'V__ISOBARIC_850'
        },
        V_700: {
            nom: 'Vent V 700hPa',
            prefix: 'V__ISOBARIC_700',
            unitat: 'm/s',
            carpeta: 'V__ISOBARIC_700'
        },

        // ═══ 3D — Vent total (FF) ═══
        FF_700: {
            nom: 'Vent total 700hPa',
            prefix: 'FF__ISOBARIC_700',
            unitat: 'm/s',
            carpeta: 'FF__ISOBARIC_700'
        },
        FF_500: {
            nom: 'Vent total 500hPa',
            prefix: 'FF__ISOBARIC_500',
            unitat: 'm/s',
            carpeta: 'FF__ISOBARIC_500'
        },

        // ═══ 3D — Velocitat vertical ═══
        VV_925: {
            nom: 'Vel. vertical 925hPa',
            prefix: 'VV__ISOBARIC_925',
            unitat: 'Pa/s',
            carpeta: 'VV__ISOBARIC_925'
        },
        VV_850: {
            nom: 'Vel. vertical 850hPa',
            prefix: 'VV__ISOBARIC_850',
            unitat: 'Pa/s',
            carpeta: 'VV__ISOBARIC_850'
        },
        VV_700: {
            nom: 'Vel. vertical 700hPa',
            prefix: 'VV__ISOBARIC_700',
            unitat: 'Pa/s',
            carpeta: 'VV__ISOBARIC_700'
        },
        VV_500: {
            nom: 'Vel. vertical 500hPa',
            prefix: 'VV__ISOBARIC_500',
            unitat: 'Pa/s',
            carpeta: 'VV__ISOBARIC_500'
        },

        // ═══ 3D — Humitat ═══
        HU_925: {
            nom: 'Humitat 925hPa',
            prefix: 'HU__ISOBARIC_925',
            unitat: '%',
            carpeta: 'HU__ISOBARIC_925'
        },
        HU_700: {
            nom: 'Humitat 700hPa',
            prefix: 'HU__ISOBARIC_700',
            unitat: '%',
            carpeta: 'HU__ISOBARIC_700'
        },

        // ═══ 3D — Punt de rosada ═══
        TD_850: {
            nom: 'Punt rosada 850hPa',
            prefix: 'TD__ISOBARIC_850',
            unitat: '°C',
            carpeta: 'TD__ISOBARIC_850'
        },
        TD_500: {
            nom: 'Punt rosada 500hPa',
            prefix: 'TD__ISOBARIC_500',
            unitat: '°C',
            carpeta: 'TD__ISOBARIC_500'
        },

        // ═══ 3D — Aigua precipitable ═══
        TPW_925: {
            nom: 'Aigua precipitable 925hPa',
            prefix: 'TPW__ISOBARIC_925',
            unitat: 'kg/m²',
            carpeta: 'TPW__ISOBARIC_925'
        },
        TPW_850: {
            nom: 'Aigua precipitable 850hPa',
            prefix: 'TPW__ISOBARIC_850',
            unitat: 'kg/m²',
            carpeta: 'TPW__ISOBARIC_850'
        },
        TPW_700: {
            nom: 'Aigua precipitable 700hPa',
            prefix: 'TPW__ISOBARIC_700',
            unitat: 'kg/m²',
            carpeta: 'TPW__ISOBARIC_700'
        },

        // ═══ 3D — TKE (Energia cinètica turbulenta) ═══
        TKE_925: {
            nom: 'TKE 925hPa',
            prefix: 'TKE__ISOBARIC_925',
            unitat: 'm²/s²',
            carpeta: 'TKE__ISOBARIC_925'
        },
        TKE_850: {
            nom: 'TKE 850hPa',
            prefix: 'TKE__ISOBARIC_850',
            unitat: 'm²/s²',
            carpeta: 'TKE__ISOBARIC_850'
        },

        // ═══ 3D — Núvols (aigua) ═══
        CLD_WATER_700: {
            nom: 'Aigua núvols 700hPa',
            prefix: 'CLD_WATER__ISOBARIC_700',
            unitat: 'g/kg',
            carpeta: 'CLD_WATER__ISOBARIC_700'
        },
        CLD_WATER_500: {
            nom: 'Aigua núvols 500hPa',
            prefix: 'CLD_WATER__ISOBARIC_500',
            unitat: 'g/kg',
            carpeta: 'CLD_WATER__ISOBARIC_500'
        },

        // ═══ 3D — Núvols (gel) ═══
        CIWC_850: {
            nom: 'Gel núvols 850hPa',
            prefix: 'CIWC__ISOBARIC_850',
            unitat: 'g/kg',
            carpeta: 'CIWC__ISOBARIC_850'
        },
        CIWC_700: {
            nom: 'Gel núvols 700hPa',
            prefix: 'CIWC__ISOBARIC_700',
            unitat: 'g/kg',
            carpeta: 'CIWC__ISOBARIC_700'
        },
        CIWC_500: {
            nom: 'Gel núvols 500hPa',
            prefix: 'CIWC__ISOBARIC_500',
            unitat: 'g/kg',
            carpeta: 'CIWC__ISOBARIC_500'
        },

        // ═══ 3D — Núvols (pluja) ═══
        CLD_RAIN_700: {
            nom: 'Pluja núvols 700hPa',
            prefix: 'CLD_RAIN__ISOBARIC_700',
            unitat: 'g/kg',
            carpeta: 'CLD_RAIN__ISOBARIC_700'
        },
        CLD_RAIN_500: {
            nom: 'Pluja núvols 500hPa',
            prefix: 'CLD_RAIN__ISOBARIC_500',
            unitat: 'g/kg',
            carpeta: 'CLD_RAIN__ISOBARIC_500'
        },

        // ═══ 3D — Núvols (neu) ═══
        CLD_SNOW_700: {
            nom: 'Neu núvols 700hPa',
            prefix: 'CLD_SNOW__ISOBARIC_700',
            unitat: 'g/kg',
            carpeta: 'CLD_SNOW__ISOBARIC_700'
        },
        CLD_SNOW_500: {
            nom: 'Neu núvols 500hPa',
            prefix: 'CLD_SNOW__ISOBARIC_500',
            unitat: 'g/kg',
            carpeta: 'CLD_SNOW__ISOBARIC_500'
        },

        // ═══ 3D — Reflectivitat ═══
        RFLCTVT_DBZ_700: {
            nom: 'Reflectivitat 700hPa',
            prefix: 'RFLCTVT_DBZ__ISOBARIC_700',
            unitat: 'dBZ',
            carpeta: 'RFLCTVT_DBZ__ISOBARIC_700'
        },
        RFLCTVT_DBZ_500: {
            nom: 'Reflectivitat 500hPa',
            prefix: 'RFLCTVT_DBZ__ISOBARIC_500',
            unitat: 'dBZ',
            carpeta: 'RFLCTVT_DBZ__ISOBARIC_500'
        },

        // ═══ 3D — Partícules de gel ═══
        ICEP_850: {
            nom: 'Partícules gel 850hPa',
            prefix: 'ICEP__ISOBARIC_850',
            unitat: '',
            carpeta: 'ICEP__ISOBARIC_850'
        },
        ICEP_700: {
            nom: 'Partícules gel 700hPa',
            prefix: 'ICEP__ISOBARIC_700',
            unitat: '',
            carpeta: 'ICEP__ISOBARIC_700'
        },
        ICEP_500: {
            nom: 'Partícules gel 500hPa',
            prefix: 'ICEP__ISOBARIC_500',
            unitat: '',
            carpeta: 'ICEP__ISOBARIC_500'
        },
    },
    
    // ═══ PALETES DE COLORS ═══
    paletes: {
        // 2D - Tempestes
        CAPE_INS__GROUND: {
            nivells: [0, 100, 300, 500, 700, 900, 1100, 1300, 1500, 1800, 2100, 2400, 2800, 3200, 3800, 5000, 6500, 8000, 9000],
            colors: ['#002878', '#0050c8', '#008cff', '#00c8ff', '#00ffc8', '#78ff50', '#dcff00', '#ffff00', '#ffc800', '#ff8c00', '#ff3c00', '#ff0000', '#ff008c', '#ff00dc', '#c800ff', '#9900cc', '#660099', '#330066', '#1a0033']
        },
        MLCAPE__GROUND: {
            nivells: [0, 100, 300, 500, 700, 900, 1100, 1300, 1500, 1800, 2100, 2400, 2800, 3200, 3800, 5000, 6500, 8000, 9000],
            colors: ['#002878', '#0050c8', '#008cff', '#00c8ff', '#00ffc8', '#78ff50', '#dcff00', '#ffff00', '#ffc800', '#ff8c00', '#ff3c00', '#ff0000', '#ff008c', '#ff00dc', '#c800ff', '#9900cc', '#660099', '#330066', '#1a0033']
        },
        CIN__GROUND: {
            nivells: [-300, -200, -150, -100, -80, -60, -40, -20, -10, 0, 10],
            colors: ['#1a0033', '#330066', '#660099', '#9900cc', '#cc00ff', '#ff00cc', '#ff0066', '#ff3300', '#ff9900', '#ffff00', '#ffffff']
        },
        DIAG_EHI__GROUND: {
            nivells: [0, 0.5, 1, 2, 3, 4, 5, 7, 9, 11, 13, 16, 20, 25, 30, 40, 50, 70, 100],
            colors: ['#000000', '#1a0033', '#330066', '#660099', '#9900cc', '#cc00ff', '#ff00cc', '#ff0066', '#ff0000', '#ff4400', '#ff8800', '#ffcc00', '#ffff00', '#ccff00', '#88ff00', '#44ff00', '#00ff00', '#00cc44', '#009988']
        },
        COLONNE_VAPO__GROUND: {
            nivells: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
            colors: ['#ffffff', '#e0f0ff', '#c0e0ff', '#a0d0ff', '#80c0ff', '#60b0ff', '#40a0ff', '#2080ff', '#0060ff', '#0050d0', '#0040a0', '#003080', '#002060', '#001040', '#000820']
        },
        ALTITUDE__GROUND: {
            nivells: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000, 2500, 3000],
            colors: ['#006600', '#008800', '#00aa00', '#33bb33', '#66cc66', '#99dd99', '#ccffcc', '#ffffcc', '#ffdd99', '#ffbb66', '#ff9933', '#ee8822', '#dd7711', '#cc6600', '#bb5500', '#aa4400', '#883300', '#662200']
        },

        // 3D - Temperatura
        T__ISOBARIC: {
            nivells: [-70, -55, -40, -30, -20, -10, 0, 5, 10, 15, 20, 25, 30, 38],
            colors: ['#2d004b', '#410073', '#0000ff', '#0087ff', '#00ebff', '#00ff96', '#00c800', '#78ff00', '#ffff00', '#ffc800', '#ff8c00', '#ff4600', '#ff0000', '#960096']
        },
        TA__ISOBARIC: {
            nivells: [250, 260, 270, 280, 285, 290, 295, 300, 305, 310, 315, 320, 325, 330, 335, 340, 350, 360, 370],
            colors: ['#000033', '#000066', '#000099', '#0000cc', '#0066ff', '#0099ff', '#00ccff', '#66ccff', '#99ccff', '#ccffff', '#ffffcc', '#ffcc99', '#ff9966', '#ff6633', '#ff3300', '#cc0000', '#990000', '#660000', '#330000']
        },
        TB__ISOBARIC: {
            nivells: [250, 260, 270, 280, 285, 290, 295, 300, 305, 310, 315, 320, 325, 330, 335, 340, 350, 360, 370],
            colors: ['#000033', '#000066', '#000099', '#0000cc', '#0066ff', '#0099ff', '#00ccff', '#66ccff', '#99ccff', '#ccffff', '#ffffcc', '#ffcc99', '#ff9966', '#ff6633', '#ff3300', '#cc0000', '#990000', '#660000', '#330000']
        },
        THETA__ISOBARIC: {
            nivells: [250, 260, 270, 280, 285, 290, 295, 300, 305, 310, 315, 320, 325, 330, 335, 340, 350, 360, 370],
            colors: ['#000033', '#000066', '#000099', '#0000cc', '#0066ff', '#0099ff', '#00ccff', '#66ccff', '#99ccff', '#ccffff', '#ffffcc', '#ffcc99', '#ff9966', '#ff6633', '#ff3300', '#cc0000', '#990000', '#660000', '#330000']
        },
        THETAV__ISOBARIC: {
            nivells: [250, 260, 270, 280, 285, 290, 295, 300, 305, 310, 315, 320, 325, 330, 335, 340, 350, 360, 370],
            colors: ['#000033', '#000066', '#000099', '#0000cc', '#0066ff', '#0099ff', '#00ccff', '#66ccff', '#99ccff', '#ccffff', '#ffffcc', '#ffcc99', '#ff9966', '#ff6633', '#ff3300', '#cc0000', '#990000', '#660000', '#330000']
        },

        // 3D - Vent
        U__ISOBARIC: {
            nivells: [-30, -25, -20, -15, -10, -5, -2, 0, 2, 5, 10, 15, 20, 25, 30],
            colors: ['#0000cc', '#0033cc', '#0066cc', '#0099cc', '#00cccc', '#00cc99', '#66cc99', '#ffffff', '#ffcc99', '#ff9966', '#ff6633', '#ff3300', '#cc0000', '#990000', '#660000']
        },
        V__ISOBARIC: {
            nivells: [-30, -25, -20, -15, -10, -5, -2, 0, 2, 5, 10, 15, 20, 25, 30],
            colors: ['#0000cc', '#0033cc', '#0066cc', '#0099cc', '#00cccc', '#00cc99', '#66cc99', '#ffffff', '#ffcc99', '#ff9966', '#ff6633', '#ff3300', '#cc0000', '#990000', '#660000']
        },
        FF__ISOBARIC: {
            nivells: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
            colors: ['#ffffff', '#ffffcc', '#ffcc66', '#ff9933', '#ff6600', '#cc3300', '#990000', '#660066', '#330099', '#0000cc', '#0066ff', '#00ccff', '#00ffcc']
        },

        // 3D - Velocitat vertical
        VV__ISOBARIC: {
            nivells: [-8, -4, -2, -1, -0.5, 0, 0.5, 1, 2, 4, 8],
            colors: ['#990000', '#cc0000', '#ff3300', '#ff9966', '#ffcc99', '#ffffff', '#99ccff', '#6699ff', '#3366ff', '#0033cc', '#000099']
        },

        // 3D - Humitat
        HU__ISOBARIC: {
            nivells: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
            colors: ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#F5DEB3', '#FFFACD', '#FFFFE0', '#E0FFFF', '#87CEEB', '#4169E1', '#0000CD']
        },
        TD__ISOBARIC: {
            nivells: [-40, -30, -20, -10, -5, 0, 5, 10, 15, 20, 25, 30],
            colors: ['#000033', '#000066', '#000099', '#0000cc', '#0066ff', '#00ccff', '#66ccff', '#ccffff', '#ffffcc', '#ffcc99', '#ff9966', '#ff3300']
        },
        TPW__ISOBARIC: {
            nivells: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
            colors: ['#ffffff', '#e0f0ff', '#c0e0ff', '#a0d0ff', '#80c0ff', '#60b0ff', '#40a0ff', '#2080ff', '#0060ff', '#0050d0', '#0040a0', '#003080', '#002060', '#001040', '#000820']
        },

        // 3D - TKE
        TKE__ISOBARIC: {
            nivells: [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18, 22, 26, 30, 40, 50],
            colors: ['#000033', '#000066', '#000099', '#0000cc', '#0066ff', '#0099ff', '#00ccff', '#66ccff', '#99ccff', '#ccffff', '#ffffcc', '#ffcc99', '#ff9966', '#ff6633', '#ff3300', '#cc0000', '#990000', '#660000', '#330000']
        },

        // 3D - Núvols
        CLD_WATER__ISOBARIC: {
            nivells: [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 15.0, 20.0, 30.0],
            colors: ['#ffffff', '#e0f0ff', '#c0e0ff', '#a0d0ff', '#80c0ff', '#60b0ff', '#40a0ff', '#2080ff', '#0060ff', '#0050d0', '#0040a0', '#003080', '#002060', '#001040', '#000820', '#000010', '#000008', '#000000']
        },
        CIWC__ISOBARIC: {
            nivells: [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 15.0, 20.0, 30.0],
            colors: ['#ffffff', '#e0f0ff', '#c0e0ff', '#a0d0ff', '#80c0ff', '#60b0ff', '#40a0ff', '#2080ff', '#0060ff', '#0050d0', '#0040a0', '#003080', '#002060', '#001040', '#000820', '#000010', '#000008', '#000000']
        },
        CLD_RAIN__ISOBARIC: {
            nivells: [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 15.0, 20.0, 30.0],
            colors: ['#ffffff', '#e0f0ff', '#c0e0ff', '#a0d0ff', '#80c0ff', '#60b0ff', '#40a0ff', '#2080ff', '#0060ff', '#0050d0', '#0040a0', '#003080', '#002060', '#001040', '#000820', '#000010', '#000008', '#000000']
        },
        CLD_SNOW__ISOBARIC: {
            nivells: [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 15.0, 20.0, 30.0],
            colors: ['#ffffff', '#e0f0ff', '#c0e0ff', '#a0d0ff', '#80c0ff', '#60b0ff', '#40a0ff', '#2080ff', '#0060ff', '#0050d0', '#0040a0', '#003080', '#002060', '#001040', '#000820', '#000010', '#000008', '#000000']
        },

        // 3D - Reflectivitat
        RFLCTVT_DBZ__ISOBARIC: {
            nivells: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
            colors: ['#00ffff', '#00ccff', '#0099ff', '#0066ff', '#0000ff', '#00ff00', '#00cc00', '#009900', '#ffff00', '#ffcc00', '#ff9900', '#ff6600', '#ff0000', '#cc0000', '#990099']
        },

        // 3D - Partícules de gel
        ICEP__ISOBARIC: {
            nivells: [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 15.0, 20.0, 30.0],
            colors: ['#ffffff', '#e0f0ff', '#c0e0ff', '#a0d0ff', '#80c0ff', '#60b0ff', '#40a0ff', '#2080ff', '#0060ff', '#0050d0', '#0040a0', '#003080', '#002060', '#001040', '#000820', '#000010', '#000008', '#000000']
        },
    },
    
    // ═══ ORGANITZACIÓ PER GRUPS ═══
    grupsVariables: {
        'Tempestes Severes': [
            'CAPE_INS__GROUND', 
            'MLCAPE__GROUND', 
            'CIN__GROUND', 
            'DIAG_EHI__GROUND'
        ],
        'Vapor i Altitud': [
            'COLONNE_VAPO__GROUND', 
            'ALTITUDE__GROUND'
        ],
        'Temperatura': [
            'T_925', 'T_850', 'T_700', 'T_500',
            'TA_850', 'TA_700', 'TA_500',
            'TB_850', 'TB_700', 'TB_500',
            'THETA_850', 'THETA_700', 'THETA_500',
            'THETAV_925', 'THETAV_850', 'THETAV_700'
        ],
        'Vent': [
            'U_925', 'U_850', 'U_700',
            'V_850', 'V_700',
            'FF_700', 'FF_500'
        ],
        'Velocitat Vertical': [
            'VV_925', 'VV_850', 'VV_700', 'VV_500'
        ],
        'Humitat': [
            'HU_925', 'HU_700',
            'TD_850', 'TD_500',
            'TPW_925', 'TPW_850', 'TPW_700'
        ],
        'Núvols': [
            'CLD_WATER_700', 'CLD_WATER_500',
            'CIWC_850', 'CIWC_700', 'CIWC_500',
            'CLD_RAIN_700', 'CLD_RAIN_500',
            'CLD_SNOW_700', 'CLD_SNOW_500'
        ],
        'Reflectivitat': [
            'RFLCTVT_DBZ_700', 'RFLCTVT_DBZ_500'
        ],
        'Altres': [
            'TKE_925', 'TKE_850',
            'ICEP_850', 'ICEP_700', 'ICEP_500'
        ]
    },
    
    ordreZones: ['espanya_ne'],
    intervalAnimacio: 800,
};

// ═══ COORDENADES DE LA ZONA ═══
const COORDENADES_ZONES = {
    "espanya_ne": {
        "nom": "Espanya (NE)",
        "lon_min": 0.1,
        "lon_max": 3.4,
        "lat_min": 40.3,
        "lat_max": 42.9
    },
};

let mapapngState = {
    zonaActiva: 'espanya_ne',
    variableActiva: 'CAPE_INS__GROUND',
    horaActiva: 0,
    horesDisponibles: [],
    reproduint: false,
    timerAnimacio: null,
    geojsonLayers: [],
    marcadorPoblacio: null,
};

// ═══════════════════════════════════════════════════════════════════════
//  FUNCIONS
// ═══════════════════════════════════════════════════════════════════════

function crearEscalaColors() {
    const container = document.getElementById('mapapng-legend');
    if (!container) return;
    
    const varNom = mapapngState.variableActiva;
    const varDef = MAPAPNG_CONFIG.variables[varNom];
    const paleta = MAPAPNG_CONFIG.paletes[varNom] || MAPAPNG_CONFIG.paletes['CAPE_INS__GROUND'];
    
    if (!varDef || !paleta) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '2px';
    container.innerHTML = '';
    
    const nomEl = document.createElement('div');
    nomEl.style.cssText = 'font-size:11px;font-weight:700;color:#1a1a1a;letter-spacing:0.3px;';
    nomEl.textContent = varDef.nom;
    container.appendChild(nomEl);
    
    const barraWrapper = document.createElement('div');
    barraWrapper.style.cssText = 'display:flex;align-items:center;gap:6px;';
    
    const minVal = paleta.nivells[0];
    const maxVal = paleta.nivells[paleta.nivells.length - 1];
    const unitat = varDef.unitat || '';
    
    const minEl = document.createElement('span');
    minEl.style.cssText = 'font-size:9px;color:#333;font-weight:600;min-width:30px;text-align:right;';
    minEl.textContent = minVal;
    barraWrapper.appendChild(minEl);
    
    const barra = document.createElement('div');
    barra.style.cssText = 'display:flex;height:16px;border-radius:4px;overflow:hidden;border:1px solid #999;width:200px;flex-shrink:0;';
    
    paleta.colors.forEach(color => {
        const seg = document.createElement('div');
        seg.style.cssText = `flex:1;background:${color};`;
        barra.appendChild(seg);
    });
    barraWrapper.appendChild(barra);
    
    const maxEl = document.createElement('span');
    maxEl.style.cssText = 'font-size:9px;color:#333;font-weight:600;min-width:50px;text-align:left;';
    maxEl.textContent = maxVal + (unitat ? ' ' + unitat : '');
    barraWrapper.appendChild(maxEl);
    
    container.appendChild(barraWrapper);
    
    const numIntermedis = 4;
    const intermedisWrapper = document.createElement('div');
    intermedisWrapper.style.cssText = 'display:flex;justify-content:space-between;width:200px;padding:0 30px;margin-top:1px;';
    
    for (let i = 1; i <= numIntermedis; i++) {
        const idx = Math.round((i / (numIntermedis + 1)) * (paleta.nivells.length - 1));
        const valor = paleta.nivells[idx];
        const valEl = document.createElement('span');
        valEl.style.cssText = 'font-size:8px;color:#555;font-weight:500;';
        if (Math.abs(valor) >= 1000) {
            valEl.textContent = Math.round(valor);
        } else if (Math.abs(valor) >= 100) {
            valEl.textContent = Math.round(valor);
        } else if (Math.abs(valor) >= 10) {
            valEl.textContent = Math.round(valor * 10) / 10;
        } else {
            valEl.textContent = valor;
        }
        intermedisWrapper.appendChild(valEl);
    }
    
    container.appendChild(intermedisWrapper);
}

function latLonAPixel(lon, lat, zona, width, height) {
    const x = ((lon - zona.lon_min) / (zona.lon_max - zona.lon_min)) * width;
    const y = ((zona.lat_max - lat) / (zona.lat_max - zona.lat_min)) * height;
    return { x, y };
}

function posarMarcadorPoblacio(lat, lon, nom) {
    mapapngState.marcadorPoblacio = { lat, lon, nom };
    const img = document.getElementById('mapapng-img');
    if (img && img.complete && img.naturalWidth > 0) {
        dibuixarGeojson();
        dibuixarMarcadorPoblacio();
    }
}

function dibuixarMarcadorPoblacio() {
    const canvas = document.getElementById('mapapng-overlay');
    const img = document.getElementById('mapapng-img');
    if (!canvas || !img || !mapapngState.marcadorPoblacio) return;
    
    const zona = COORDENADES_ZONES[mapapngState.zonaActiva];
    if (!zona) return;
    
    const rect = calcularRectangleContain(img);
    if (!rect || rect.width === 0 || rect.height === 0) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    const { x, y } = latLonAPixel(
        mapapngState.marcadorPoblacio.lon,
        mapapngState.marcadorPoblacio.lat,
        zona, rect.width, rect.height
    );
    
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#FF0000';
    ctx.fill();
    
    if (mapapngState.marcadorPoblacio.nom) {
        const nom = mapapngState.marcadorPoblacio.nom;
        ctx.font = 'bold 12px "Segoe UI", Tahoma, sans-serif';
        const textWidth = ctx.measureText(nom).width;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x + 14, y - 12, textWidth + 12, 24, 5);
        } else {
            ctx.rect(x + 14, y - 12, textWidth + 12, 24);
        }
        ctx.fill();
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(nom, x + 20, y + 1);
    }
}

async function carregarGeojson() {
    const resultats = await Promise.all(
        MAPAPNG_CONFIG.geojsonPaths.map(async (path) => {
            try {
                const resp = await fetch(path);
                if (resp.ok) return await resp.json();
            } catch (e) {}
            return null;
        })
    );
    mapapngState.geojsonLayers = resultats.filter(g => g && g.features);
}

function calcularRectangleContain(img) {
    const wrapper = img.closest('.mapapng-image-wrapper');
    if (!wrapper) return null;
    const imgRect = img.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    if (imgRect.width === 0 || imgRect.height === 0) return null;
    return {
        width: imgRect.width,
        height: imgRect.height,
        offsetX: imgRect.left - wrapperRect.left,
        offsetY: imgRect.top - wrapperRect.top,
    };
}

function dibuixarGeojson() {
    const canvas = document.getElementById('mapapng-overlay');
    const img = document.getElementById('mapapng-img');
    if (!canvas || !img || !mapapngState.geojsonLayers || mapapngState.geojsonLayers.length === 0) return;
    
    const zona = COORDENADES_ZONES[mapapngState.zonaActiva];
    if (!zona) return;
    
    const rect = calcularRectangleContain(img);
    if (!rect || rect.width === 0 || rect.height === 0) return;
    
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.style.left = `${rect.offsetX}px`;
    canvas.style.top = `${rect.offsetY}px`;
    canvas.style.transform = 'none';
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    mapapngState.geojsonLayers.forEach(geojsonData => {
        geojsonData.features.forEach(feature => {
            dibuixarGeometria(ctx, feature.geometry, zona, rect.width, rect.height);
        });
    });
}

let _mapapngResizeObserver = null;
function activarResizeObserver() {
    if (_mapapngResizeObserver) return;
    const container = document.getElementById('mapapng-image-container');
    if (!container || typeof ResizeObserver === 'undefined') return;
    _mapapngResizeObserver = new ResizeObserver(() => {
        const img = document.getElementById('mapapng-img');
        if (img && img.complete && img.naturalWidth > 0) {
            dibuixarGeojson();
            dibuixarMarcadorPoblacio();
        }
    });
    _mapapngResizeObserver.observe(container);
}

function dibuixarGeometria(ctx, geometry, zona, width, height) {
    if (!geometry || !geometry.coordinates) return;
    switch (geometry.type) {
        case 'Polygon':
            geometry.coordinates.forEach(ring => dibuixarLinia(ctx, ring, zona, width, height));
            break;
        case 'MultiPolygon':
            geometry.coordinates.forEach(poly => poly.forEach(ring => dibuixarLinia(ctx, ring, zona, width, height)));
            break;
        case 'LineString':
            dibuixarLinia(ctx, geometry.coordinates, zona, width, height);
            break;
        case 'MultiLineString':
            geometry.coordinates.forEach(linia => dibuixarLinia(ctx, linia, zona, width, height));
            break;
        case 'Point':
            dibuixarPunt(ctx, geometry.coordinates, zona, width, height);
            break;
        case 'MultiPoint':
            geometry.coordinates.forEach(coord => dibuixarPunt(ctx, coord, zona, width, height));
            break;
    }
}

function dibuixarPunt(ctx, coord, zona, width, height) {
    if (!coord || coord.length < 2) return;
    const [lon, lat] = coord;
    const { x, y } = latLonAPixel(lon, lat, zona, width, height);
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fill();
}

function dibuixarLinia(ctx, coords, zona, width, height) {
    if (!coords || coords.length < 2) return;
    ctx.beginPath();
    let first = true;
    coords.forEach(([lon, lat]) => {
        const { x, y } = latLonAPixel(lon, lat, zona, width, height);
        if (first) { ctx.moveTo(x, y); first = false; }
        else { ctx.lineTo(x, y); }
    });
    ctx.stroke();
}

async function existeixImatge(url) {
    try {
        const resp = await fetch(url, { method: 'HEAD' });
        return resp.ok;
    } catch (e) {
        return false;
    }
}

function construirUrlImatge(zonaNom, varDef, ts) {
    const varPrefix = varDef.prefix;
    const carpeta = varDef.carpeta;
    return `${MAPAPNG_CONFIG.basePath}${carpeta}/${varPrefix}_${ts}.png`;
}

async function escanejarImatges(zonaNom, variableNom) {
    const varDef = MAPAPNG_CONFIG.variables[variableNom];
    if (!varDef) return [];

    const horesFix = ['20260816-1800', '20260816-1900', '20260816-2000'];
    const hores = [];
    
    for (const ts of horesFix) {
        const imgUrl = construirUrlImatge(zonaNom, varDef, ts);
        if (await existeixImatge(imgUrl)) {
            hores.push({ timestamp: ts + 'z', url: imgUrl, horaStr: formatarHoraLocal(ts + 'z') });
        }
    }

    hores.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return hores;
}

function formatarHoraLocal(timestamp) {
    const match = timestamp.match(/(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})z?/i);
    if (!match) return timestamp;
    const [, y, m, d, hh, mm] = match;
    const dataUTC = new Date(Date.UTC(parseInt(y), parseInt(m)-1, parseInt(d), parseInt(hh), parseInt(mm)));
    const options = { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
    const parts = new Intl.DateTimeFormat('ca-ES', options).formatToParts(dataUTC);
    const get = (type) => parts.find(p => p.type === type)?.value || '';
    return `${get('day')}/${get('month')} ${get('hour')}:${get('minute')}`;
}

function crearSelectorZones() {
    const container = document.getElementById('mapapng-zones');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'none';
}

function crearSelectorVariables() {
    const container = document.getElementById('mapapng-variables');
    if (!container) return;
    container.innerHTML = '';
    Object.entries(MAPAPNG_CONFIG.grupsVariables).forEach(([nomGrup, variables]) => {
        const grupTitol = document.createElement('div');
        grupTitol.className = 'mapapng-var-group-title';
        grupTitol.textContent = nomGrup;
        container.appendChild(grupTitol);
        variables.forEach(varNom => {
            const varDef = MAPAPNG_CONFIG.variables[varNom];
            if (!varDef) return;
            const btn = document.createElement('button');
            btn.className = 'mapapng-var-btn' + (mapapngState.variableActiva === varNom ? ' active' : '');
            btn.textContent = varDef.nom;
            btn.onclick = () => canviarVariable(varNom);
            container.appendChild(btn);
        });
    });
}

function crearTimelineHores() {
    const container = document.getElementById('mapapng-timeline');
    if (!container) return;
    container.innerHTML = '';
    if (mapapngState.horesDisponibles.length === 0) {
        container.innerHTML = '<span style="color:#556680;font-size:11px;">Sense imatges</span>';
        return;
    }
    mapapngState.horesDisponibles.forEach((hora, idx) => {
        const btn = document.createElement('button');
        btn.className = 'mapapng-hora-btn' + (mapapngState.horaActiva === idx ? ' active' : '');
        btn.textContent = hora.horaStr;
        btn.onclick = () => canviarHora(idx);
        container.appendChild(btn);
    });
}

async function canviarZona(zonaNom, mantenirMarcador = true) {
    const horaAnterior = mapapngState.horaActiva;
    mapapngState.zonaActiva = zonaNom;
    if (!mantenirMarcador) mapapngState.marcadorPoblacio = null;
    crearSelectorZones();
    await carregarHoresZona();
    if (horaAnterior > 0 && horaAnterior < mapapngState.horesDisponibles.length) {
        mapapngState.horaActiva = horaAnterior;
        crearTimelineHores();
        actualitzarImatge();
    }
    if (mapapngState.marcadorPoblacio) {
        setTimeout(() => {
            dibuixarGeojson();
            dibuixarMarcadorPoblacio();
        }, 150);
    }
}

async function canviarVariable(varNom) {
    if (!MAPAPNG_CONFIG.variables[varNom]) return;
    const horaAnterior = mapapngState.horaActiva;
    mapapngState.variableActiva = varNom;
    crearSelectorVariables();
    crearEscalaColors();
    await carregarHoresZona();
    if (horaAnterior > 0 && horaAnterior < mapapngState.horesDisponibles.length) {
        mapapngState.horaActiva = horaAnterior;
        crearTimelineHores();
        actualitzarImatge();
    }
}

function canviarHora(idx) {
    if (idx < 0 || idx >= mapapngState.horesDisponibles.length) return;
    mapapngState.horaActiva = idx;
    crearTimelineHores();
    actualitzarImatge();
}

async function carregarHoresZona() {
    const imgContainer = document.getElementById('mapapng-image-container');
    if (imgContainer) imgContainer.innerHTML = '<div class="mapapng-loading">Carregant...</div>';
    const hores = await escanejarImatges(mapapngState.zonaActiva, mapapngState.variableActiva);
    mapapngState.horesDisponibles = hores;
    if (hores.length === 0) {
        if (imgContainer) imgContainer.innerHTML = '<div class="mapapng-error">Sense imatges</div>';
        crearTimelineHores();
        return;
    }
    crearTimelineHores();
    actualitzarImatge();
}

function actualitzarImatge() {
    const imgContainer = document.getElementById('mapapng-image-container');
    if (!imgContainer) return;
    const hora = mapapngState.horesDisponibles[mapapngState.horaActiva];
    if (!hora) return;
    
    imgContainer.innerHTML = `
        <div class="mapapng-image-wrapper">
            <img src="${hora.url}" class="mapapng-image" id="mapapng-img">
            <canvas class="mapapng-overlay" id="mapapng-overlay"></canvas>
        </div>
    `;
    
    const img = document.getElementById('mapapng-img');
    if (img) {
        img.onload = () => {
            dibuixarGeojson();
            dibuixarMarcadorPoblacio();
        };
        if (img.complete && img.naturalWidth > 0) {
            dibuixarGeojson();
            dibuixarMarcadorPoblacio();
        }
    }
    activarResizeObserver();
}

function toggleAnimacio() {
    const btn = document.getElementById('mapapng-play');
    if (mapapngState.reproduint) {
        clearInterval(mapapngState.timerAnimacio);
        mapapngState.reproduint = false;
        if (btn) { btn.textContent = '▶ Play'; btn.classList.remove('playing'); }
    } else {
        if (mapapngState.horesDisponibles.length === 0) return;
        mapapngState.reproduint = true;
        if (btn) { btn.textContent = '⏹ Stop'; btn.classList.add('playing'); }
        mapapngState.timerAnimacio = setInterval(() => {
            canviarHora((mapapngState.horaActiva + 1) % mapapngState.horesDisponibles.length);
        }, MAPAPNG_CONFIG.intervalAnimacio);
    }
}

document.addEventListener('keydown', (e) => {
    if (mapapngState.horesDisponibles.length === 0) return;
    if (e.key === 'ArrowLeft') canviarHora((mapapngState.horaActiva - 1 + mapapngState.horesDisponibles.length) % mapapngState.horesDisponibles.length);
    if (e.key === 'ArrowRight') canviarHora((mapapngState.horaActiva + 1) % mapapngState.horesDisponibles.length);
    if (e.key === ' ') { e.preventDefault(); toggleAnimacio(); }
});

document.addEventListener('DOMContentLoaded', async () => {
    await carregarGeojson();
    crearSelectorZones();
    crearSelectorVariables();
    crearEscalaColors();
    await carregarHoresZona();
    document.getElementById('mapapng-play')?.addEventListener('click', toggleAnimacio);
    document.getElementById('mapapng-prev')?.addEventListener('click', () => {
        if (mapapngState.horesDisponibles.length > 0)
            canviarHora((mapapngState.horaActiva - 1 + mapapngState.horesDisponibles.length) % mapapngState.horesDisponibles.length);
    });
    document.getElementById('mapapng-next')?.addEventListener('click', () => {
        if (mapapngState.horesDisponibles.length > 0)
            canviarHora((mapapngState.horaActiva + 1) % mapapngState.horesDisponibles.length);
    });
});

window.obtenirZonaDePunt = () => 'espanya_ne';
window.posarMarcadorPoblacio = posarMarcadorPoblacio;
window.canviarZona = canviarZona;
window.crearEscalaColors = crearEscalaColors; //