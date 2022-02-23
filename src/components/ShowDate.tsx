import { FC } from 'react'
import { DateLikeObject } from '../contents'

export const ShowDate: FC<{ date: DateLikeObject | null }> = ({ date }) => {
  if (date == null) return null
  const { year, month, day } = date
  const str = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  return <time dateTime={str}>{str}</time>
}
