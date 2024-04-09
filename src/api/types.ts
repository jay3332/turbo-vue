export interface CourseMetadata {
  Children: any[]
  ClassDetailControl: string
  ID: number,
  IsCurriculumModuleEnabled: boolean,
  IsPostsViewLinkedAvailable: boolean,
  IsStandardsAvailable: boolean,
  Name: string,
  TeacherName: string,
  room: string,
  markPreview: string,
  scorePreview: string,
}

export interface AssignmentComment {
  comment: string,
  commentID: number,
  commentCode: string,
  isGradeBookMissingMark: boolean,
  penaltyPct: number | null,
  removeWhenScored: boolean,
  assignmentValue: string,
  assignmentValueIsPercent: boolean,
  standardsValue: string | null,
  standardsValueIsPercent: boolean,
}

export interface MeasureType {
  id: number,
  name: string,
  fgColor: string,
  bgColor: string,
  dropScores: number,
  weight: number,
}

export interface ScoreBoundary {
  score: string,
  value: number,
  lowScore: number,
  highScore: number,
  limitPCTMaxValue: number,
  limitPCTCalcMethod: string,
}

export interface ScoringPolicy {
  id: number,
  name: string,
  max: number,
  details: ScoreBoundary[],
}

export interface StudentPolicy {
  id: number,
  name: string,
  img: string,
  manualMark: string,
  lockScore: boolean,
  calculatedMark: string,
  percentage: number,
  postedGrade: boolean,
  postIsError: boolean,
  postMessage: string,
}

export interface GradingPolicy {
  comment: AssignmentComment[],
  measureTypes: MeasureType[],
  reportCardScoreTypes: ScoringPolicy[],
  students: StudentPolicy[],
  defaultReportCardScoreTypeId: number,
}

export interface BaseGradeSummary {
  studentId: number,
  assignmentCount: number,
  incompleteAssignments: number,
  points: number,
  pointsPossible: number,
  reportCardScoreTypeId: number,
  calculatedMark: string,
  maxValue: number,
}

export interface CourseOverallSummary extends BaseGradeSummary {
  gradingPeriodId: number,
  lockScore: boolean,
  totalWeightedPercentage: number,
  totalAssignmentWeight: number,
  manualMark: string,
}

export interface CourseWeightSummary extends BaseGradeSummary {
  measureTypeId: number,
  measureTypeWeight: number,
}

export interface Course {
  GradingPeriodName: string,
  assignments: Assignment[],
  classGrades: CourseOverallSummary[], // should just be one element
  classId: number,
  className: number, // long name
  gradingPeriodId: number,
  measureTypeGrades: CourseWeightSummary[],
}

type NumericString = `${number}`

export interface Assignment {
  category: string,
  commentCode: string | null,
  dueDate: string, // mm/dd/yyyy
  excused: boolean,
  gradeBookCategoryId: number,
  gradeBookId: number,
  gradeBookScoreTypeId: number,
  gradingPeriodId: number,
  isForGrading: boolean,
  maxScore: NumericString,
  maxValue: number,
  measureTypeId: number,
  name?: string,
  reportCardScoreTypeId: number,
  score: NumericString | null,
  studentId: number,
  week: string, // mm/dd/yyyy through mm/dd/yyyy
}

export interface GradingPeriod {
  Name: string,
  GroupName: string,
  GU: string,
  IsSubjectView: boolean,
  IsLoaded: boolean,
  OrgYearGU: string,
  schoolID: number,
  defaultFocus: boolean,
}

export interface LoginResponse {
  token: string,
  courseOrder: CourseMetadata[],
  policy: GradingPolicy,
  student: StudentInfo,
  gradingPeriods: Record<string, GradingPeriod>,
}

export interface DistrictInfo {
  name: string,
  address: string,
  host: string,
}

export interface StudentInfo {
  sisNumber: string,
  name: string,
  schoolName: string,
  schoolPhone: string,
  photoUrl: string,
}
