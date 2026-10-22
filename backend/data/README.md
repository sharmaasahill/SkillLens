# Data

`india_jobs.csv.gz` is a cleaned copy of the [Indian Job Market Dataset 2025](https://www.kaggle.com/datasets/shivamshrivastava21/indian-job-market-dataset-2025-2026) by Shivam Shrivastava: 97,316 Naukri.com postings collected in September and October 2025.

Licence: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). You may share and adapt it for non-commercial purposes, with attribution, under the same licence. This cleaned copy and `models/india_salary_model.pkl` are adaptations under those terms.

Changes from the original: duplicate job IDs and non-INR salaries removed; locations reduced to a primary city and a work mode (on-site, hybrid, remote); titles normalised; skills lowercased; descriptions shortened to 600 characters.

Rebuild with `flask --app app build-india-data` (run inside `backend`).
