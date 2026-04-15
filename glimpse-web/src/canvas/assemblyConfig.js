export const ASSEMBLY_STAGES = [
  {
    id: 'item_upper_case',
    step: '01',
    title: 'UPPER CASE',
    focusIds: ['asm_upper_shell'],
  },
  {
    id: 'item_display',
    step: '02',
    title: 'ADAFRUIT 2.13" MONOCHROME EINK DISPLAY',
    focusIds: ['asm_display'],
  },
  {
    id: 'item_feather',
    step: '03',
    title: 'ADAFRUIT ESP32-S3 REVERSE TFT FEATHER',
    focusIds: ['asm_logic'],
  },
  {
    id: 'item_switches',
    step: '04',
    title: '6 MM TACTILE BUTTON SWITCH (X2)',
    focusIds: ['asm_switches'],
  },
  {
    id: 'item_switch_cover',
    step: '05',
    title: 'SWITCH COVER',
    focusIds: ['asm_switches'],
  },
  {
    id: 'item_short_screws',
    step: '06',
    title: 'M2 x 4 MM NYLON PAN HEAD PHILLIPS SCREW',
    focusIds: ['asm_display', 'asm_switches'],
  },
  {
    id: 'item_battery',
    step: '07',
    title: 'LITHIUM ION POLYMER BATTERY 3.7V 400mAh',
    focusIds: ['asm_power'],
  },
  {
    id: 'item_usb_extension',
    step: '08',
    title: 'USB-C EXTENSION',
    focusIds: ['asm_logic'],
  },
  {
    id: 'item_haptic_driver',
    step: '09',
    title: 'ADAFRUIT DRV2605L HAPTIC MOTOR CONTROLLER',
    focusIds: ['asm_power'],
  },
  {
    id: 'item_motor',
    step: '10',
    title: 'VIBRATION MOTOR',
    focusIds: ['asm_power'],
  },
  {
    id: 'item_ring',
    step: '11',
    title: 'ADAFRUIT NEOPIXEL LED STRIP',
    focusIds: ['asm_light_ring'],
  },
  {
    id: 'item_bottom_case',
    step: '12',
    title: 'BOTTOM CASE',
    focusIds: ['asm_lower_shell'],
  },
  {
    id: 'item_long_screw',
    step: '13',
    title: 'M2 x 10 MM NYLON PAN HEAD PHILLIPS SCREW',
    focusIds: ['asm_lower_shell'],
  },
]

export const ASSEMBLY_PARTS = {
  asm_upper_shell: {
    order: 0,
    offset: [1.18, 2.4, 0.92],
    rotation: [0.18, 0.1, -0.16],
  },
  asm_display: {
    order: 1,
    offset: [0.54, 1.24, 0.34],
    rotation: [0.08, 0.08, -0.06],
  },
  asm_logic: {
    order: 2,
    offset: [0.08, 0.18, 0.06],
    rotation: [0.04, 0.05, -0.04],
  },
  asm_switches: {
    order: 3,
    offset: [1.92, 0.46, 0.82],
    rotation: [0.1, 0.26, -0.02],
  },
  asm_power: {
    order: 4,
    offset: [-0.2, -0.86, -0.12],
    rotation: [-0.04, -0.04, 0.05],
  },
  asm_light_ring: {
    order: 5,
    offset: [0.02, -1.78, 0.02],
    rotation: [-0.04, 0.04, 0.02],
  },
  asm_carabiner: {
    order: 6,
    offset: [2.42, 0.18, 1.46],
    rotation: [0.04, 0.38, -0.04],
  },
  asm_lower_shell: {
    order: 7,
    offset: [0.12, -2.9, -0.76],
    rotation: [-0.16, -0.08, 0.08],
  },
}

export const ASSEMBLY_GROUP_COUNT = Object.keys(ASSEMBLY_PARTS).length

export function getAssemblyPartId(name = '') {
  return Object.hasOwn(ASSEMBLY_PARTS, name) ? name : null
}
