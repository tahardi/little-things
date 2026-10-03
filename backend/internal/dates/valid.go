package dates

var daysInMonth = [12]int{31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31}

func Valid(month int, day int) bool {
	if month < 1 || month > 12 {
		return false
	}
	return day >= 1 && day <= daysInMonth[month-1]
}
