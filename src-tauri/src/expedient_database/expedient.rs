use chrono::prelude::*;

#[derive(Debug)]
struct Date(chrono::Date<Utc>);

#[derive(Debug)]
pub struct User {
    name: String,
    emails: Vec<String>,
    phones: Vec<String>,
}

#[derive(Debug)]
pub struct Order {
    dates: Vec<Date>,
    description: String,
}

#[derive(Debug)]
pub struct Expedient {
    users: Vec<User>,
    model: String,
    license_plate: String,
    vin: String,
    description: String,
    orders: Vec<Order>,
}

// Match -----------------

#[derive(Debug, PartialEq, Clone, Copy)]
enum MatchType {
    Inclusive,
    Similar(f32),
}

impl MatchType {
    fn max(&self, other: &Self) -> MatchType {
        match self {
            Self::Inclusive => MatchType::Inclusive,
            Self::Similar(self_match) => match other {
                Self::Inclusive => MatchType::Inclusive,
                Self::Similar(other_match) => MatchType::Similar(self_match.max(*other_match)),
            },
        }
    }
    fn downgrade_inclusive(&self) -> MatchType {
        match self {
            Self::Inclusive => MatchType::Similar(1.0),
            Self::Similar(_) => *self,
        }
    }
}

trait Filter {
    fn filter(&self, filter: &Self) -> MatchType;
}

impl Filter for String {
    fn filter(&self, filter: &Self) -> MatchType {
        if filter == "" {
            return MatchType::Similar(0.);
        }

        let filter_lowercase = filter.to_lowercase();
        let self_lowercase = self.to_lowercase();

        if self_lowercase.contains(&filter_lowercase) {
            return MatchType::Inclusive;
        }

        let mut keywords_count = 0;
        let score = filter_lowercase
            .split_whitespace()
            .fold(0f32, |score, keyword| {
                keywords_count += 1;
                if self_lowercase.contains(keyword) {
                    return score + 1.;
                }
                score
            })
            / keywords_count as f32;

        MatchType::Similar(score)
    }
}

impl Filter for Expedient {
    fn filter(&self, _filter: &Self) -> MatchType {
        MatchType::Similar(0.0)
    }
}

impl Filter for Vec<String> {
    fn filter(&self, filter: &Self) -> MatchType {
        filter
            .iter()
            .fold(MatchType::Similar(0.0), |best_match, filter_str| {
                self.iter().fold(best_match, |best_match, str| {
                    best_match.max(&str.filter(filter_str))
                })
            })
    }
}

impl Filter for User {
    fn filter(&self, filter: &Self) -> MatchType {
        let mut best_match = self.phones.filter(&filter.phones);
        best_match = best_match.max(&self.emails.filter(&filter.emails));
        best_match.max(&self.name.filter(&filter.name).downgrade_inclusive())
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn filter_string() {
        let text = "Hello to all RATIONAL creature!!";
        let s = String::from(text);

        let str_match = s.filter(&String::from(text));
        assert_eq!(format!("{:?}", str_match), "Inclusive");

        let str_match = s.filter(&String::from(text).to_uppercase());
        assert_eq!(format!("{:?}", str_match), "Inclusive");

        let str_match = s.filter(&String::from("Hello"));
        assert_eq!(format!("{:?}", str_match), "Inclusive");

        let str_match = s.filter(&String::from("rational hello"));
        assert_eq!(format!("{:?}", str_match), "Similar(1.0)");

        let str_match = s.filter(&String::from("helloall"));
        assert_eq!(format!("{:?}", str_match), "Similar(0.0)");
    }

    #[test]
    fn filter_user() {
        let juan = User {
            name: String::from("Juan Antonio Mario"),
            emails: vec![],
            phones: vec![String::from("932123456")],
        };
        let juan_first_name = User {
            name: String::from("Juan"),
            emails: vec![],
            phones: vec![],
        };
        let juan_phone = User {
            name: String::from(""),
            emails: vec![],
            phones: vec![String::from("932123456")],
        };
        let mario = User {
            name: String::from("Mario Bro"),
            emails: vec![String::from("mariobro@email.com")],
            phones: vec![String::from("123456789")],
        };
        let mario_emal = User {
            name: String::from(""),
            emails: vec![String::from("mariobro@email.com")],
            phones: vec![],
        };
        let pepa = User {
            name: String::from("Pepa la pera"),
            emails: vec![String::from("")],
            phones: vec![String::from("")],
        };

        assert_eq!(format!("{:?}", juan.filter(&juan)), "Inclusive");
        assert_eq!(format!("{:?}", juan.filter(&juan_first_name)), "Similar(1.0)");
        assert_eq!(format!("{:?}", juan.filter(&juan_phone)), "Inclusive");
        assert_eq!(format!("{:?}", juan.filter(&mario)), "Similar(0.5)");
        assert_eq!(format!("{:?}", juan.filter(&pepa)), "Similar(0.0)");
        assert_eq!(format!("{:?}", mario.filter(&mario_emal)), "Inclusive");
    }
}
