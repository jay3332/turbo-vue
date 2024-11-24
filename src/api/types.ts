type NumericString = `${number}`

export interface Course {
  classId: number,
  period: number,
  name: string
  teacher: string
  room: string
  assignments: Assignment[]
  weights: CourseWeight[]
}

export interface Assignment {
  gradebookId: number
  name: string
  type: string
  date: string // mm/dd/yyyy
  dueDate: string // mm/dd/yyyy
  score: number | null
  maxScore: number | null
  description: string | null
  notForGrading: boolean
}

export interface CourseWeight {
  name: string
  weight: number // 0.0 to 1.0
  points: number
  maxPoints: number
  mark: string | number
}

export interface GradebookInfo {
  student: StudentInfo
  gradingPeriods: GradingPeriod[]
  defaultGradingPeriod: number
  courses: Record<NumericString, Course[]>
}

export interface LoginResponse extends GradebookInfo {
  token: string
}

export interface StudentInfo {
  id: string | number
  fullName: string
  name: string
  grade: number
  school: string
}

export interface GradingPeriod {
  id: number
  name: string
  startDate: string // mm/dd/yyyy
  endDate: string // mm/dd/yyyy
}

export interface Term {
  index: number
  name: string
  beginDate: string // mm/dd/yyyy
  endDate: string // mm/dd/yyyy
}

export interface ClassPeriod {
  period: number
  name: string
  room: string
  teacher: string
}

export interface TimeBlock {
  period: number
  startTime: string // h:mm AM/PM
  endTime: string // h:mm AM/PM
}

export interface Schedule {
  termName: string
  today: {
    date: string // mm/dd/yyyy
    school: string
    scheduleName: string
    timeBlocks: TimeBlock[]
  } | null
  classes: ClassPeriod[]
  terms: Term[]
}

export interface DistrictInfo {
  name: string,
  address: string,
  host: string,
}