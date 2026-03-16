window.STUDY_DATA = {
  materials: [
    {
      id: 'gallium',
      label: 'Gallium',
      color: '#0d6172',
      note: 'Reference elemental liquid metal with very low vapor pressure.'
    },
    {
      id: 'egain',
      label: 'EGaIn',
      color: '#d87430',
      note: 'Widely used Ga-In eutectic alloy for room-temperature liquid-metal systems.'
    },
    {
      id: 'galinstan',
      label: 'Galinstan',
      color: '#2b7a55',
      note: 'Ga-In-Sn alloy with a lower melting point and strong practical relevance.'
    },
    {
      id: 'water',
      label: 'Water',
      color: '#6b7d91',
      note: 'Intuitive baseline fluid for non-specialist comparison.'
    }
  ],
  properties: [
    {
      id: 'electrical_conductivity',
      label: 'Electrical conductivity',
      unit: 'S/m',
      category: 'Transport',
      source: 'AFM 2024; Matter 2020',
      comparisonNote: 'Higher values support conductive traces, soft circuits, and shielding.',
      implication:
        'Gallium-based liquid metals behave like conductive liquids, which is why they are repeatedly used in soft interconnects, sensors, and EMI materials.',
      values: {
        gallium: 6.73e6,
        egain: 3.4e6,
        galinstan: 3.46e6,
        water: 5.0e-4
      },
      displayValues: {
        gallium: '6.73 × 10^6',
        egain: '3.40 × 10^6',
        galinstan: '3.46 × 10^6',
        water: '< 5 × 10^-4'
      }
    },
    {
      id: 'thermal_conductivity',
      label: 'Thermal conductivity',
      unit: 'W/m·K',
      category: 'Transport',
      source: 'AFM 2024; Matter 2020',
      comparisonNote: 'Higher values improve heat spreading and thermal-interface performance.',
      implication:
        'Thermal transport is a major reason liquid metals appear in cooling, thermal switches, and multifunctional composites.',
      values: {
        gallium: 29.3,
        egain: 26.6,
        galinstan: 16.5,
        water: 0.6
      }
    },
    {
      id: 'surface_tension',
      label: 'Surface tension',
      unit: 'N/m',
      category: 'Interfacial',
      source: 'AFM 2024',
      comparisonNote: 'Higher values help droplets maintain shape but complicate wetting and patterning.',
      implication:
        'High surface tension explains why droplet engineering and oxide management are central to printing, molding, and reconfiguration.',
      values: {
        gallium: 0.707,
        egain: 0.624,
        galinstan: 0.718,
        water: 0.072
      },
      displayValues: {
        gallium: '0.707',
        egain: '0.624',
        galinstan: '0.718',
        water: '0.072'
      }
    },
    {
      id: 'viscosity',
      label: 'Viscosity',
      unit: 'Pa·s',
      category: 'Fluidic',
      source: 'AFM 2024',
      comparisonNote: 'Lower values generally help flow, pumping, and reconfiguration.',
      implication:
        'Liquid metals stay much more mobile than soft solids, which is valuable for self-healing, microfluidics, and reconfigurable traces.',
      values: {
        gallium: 1.37e-3,
        egain: 1.99e-3,
        galinstan: 2.4e-3,
        water: 1.0e-3
      },
      displayValues: {
        gallium: '1.37 × 10^-3',
        egain: '1.99 × 10^-3',
        galinstan: '2.40 × 10^-3',
        water: '1.00 × 10^-3'
      }
    },
    {
      id: 'density',
      label: 'Density',
      unit: 'kg/m^3',
      category: 'Fluidic',
      source: 'AFM 2024',
      comparisonNote: 'Density matters for sedimentation, droplet stability, and composite loading.',
      implication:
        'The high density of gallium alloys affects settling, ink formulation, and filler distribution in polymer composites.',
      values: {
        gallium: 6093,
        egain: 6280,
        galinstan: 6440,
        water: 998
      }
    },
    {
      id: 'melting_point',
      label: 'Melting point',
      unit: '°C',
      category: 'Thermal window',
      source: 'AFM 2024; Matter 2020',
      comparisonNote: 'Lower values make liquid-state operation easier near room temperature.',
      implication:
        'Room-temperature liquidity is the gateway property that makes gallium alloys attractive for soft devices and adaptive composites.',
      values: {
        gallium: 29.8,
        egain: 15.5,
        galinstan: 11.0,
        water: 0
      }
    },
    {
      id: 'boiling_point',
      label: 'Boiling point',
      unit: '°C',
      category: 'Thermal window',
      source: 'AFM 2024; Nanomaterials 2025',
      comparisonNote: 'Higher values point to a wide liquid window and low evaporation risk.',
      implication:
        'The combination of low melting point and very high boiling point gives gallium systems an unusually wide working range.',
      values: {
        gallium: 2205,
        egain: 2000,
        galinstan: 1300,
        water: 100
      },
      displayValues: {
        gallium: '2205',
        egain: '2000',
        galinstan: '>1300',
        water: '100'
      }
    }
  ]
};
