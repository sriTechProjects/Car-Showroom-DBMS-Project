// Initialize express app
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const mysql = require('mysql');
const encoder = bodyParser.urlencoded();
const app = express();
const ejs = require('ejs');
const multer = require('multer');
const fs = require('fs');
const { error } = require('console');
const nodemailer = require('nodemailer');
const randomstring = require('randomstring');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'srivaths.iyer@gmail.com',
        pass: 'nhat uenc gfro lgwe'
    }
});

let customerCounter = 28

// Serve static files
app.use(express.static(path.join(__dirname, 'HTML')));
app.set('views', path.join(__dirname, 'HTML'));
app.use("/css", express.static("css"));
app.use("/assets/images", express.static(path.join(__dirname, "assets", "images")));
app.use("/js", express.static("js"));
app.use('/chart.js-4.4.2', express.static("chart.js-4.4.2"));
app.set('view engine', 'ejs');

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));

// MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'a1b2c3',
    database: 'carShowroom'
});

// Connect to MySQL
connection.connect(function (error) {
    if (error) {
        throw error;
    } else {
        console.log('MySQL Database is connected Successfully');
    }
});

// Routes
app.get('/', (req, res) => {
    const query = `
        SELECT c.car_id, c.car_name, c.imagecode, c.rating, c.price, c.colors,c.mileage, c.capacity, c.topspeed, c.year_man, 
               SUM(cs.cars_sold) AS total_cars_sold
        FROM cars c
        JOIN carshow cs ON c.car_id = cs.car_id
        GROUP BY c.car_id, c.car_name, c.imagecode, c.rating, c.price, c.colors, c.mileage, c.capacity, c.topspeed, c.year_man
        ORDER BY total_cars_sold DESC
        LIMIT 6
    `;
    connection.query(query, (error, results) => {
        if (error) {
            throw error;
        } else {
            // console.log(results);
            res.render('index', { cars: results });
        }
    });
});


app.get('/login', (req, res) => {
    res.render('login', { errorMsg: null });
});

// In your login route
app.post('/login', (req, res) => {
    var username = req.body.username;
    var password = req.body.password;
    connection.query("SELECT * FROM customers WHERE username = ? AND password = ?", [username, password], (error, results) => {
        if (error) {
            res.send(error);
        }
        console.log(results);
        if (results.length > 0) {
            req.session.loggedIn = true;
            // Redirect to home page with username as query parameter
            res.redirect('/?username=' + encodeURIComponent(username));
        } else {
            res.render('login', { errorMsg: 'Wrong Email or Password' });
        }
        res.end();
    });
});


// In your checkLoginStatus route
app.get('/checkLoginStatus', function (req, res) {
    const loggedIn = req.session.loggedIn || false;
    if (loggedIn) {
        console.log("passed");
    }
    res.json({ loggedIn: loggedIn });
});


app.get('/register', (req, res) => {
    res.render('register', { errorMsg: null });
});


// Route to handle user registration form submission and update profile form submission
app.post('/register', encoder, (req, res) => {
    const { username, email, password, cpassword } = req.body;

    if (password !== cpassword) {
        return res.render('register', { errorMsg: 'Passwords do not match' });
    }

    connection.query('SELECT email FROM customers WHERE email = ?', [email], (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).send('Error checking email');
        }

        if (results.length > 0) {
            // Email already exists
            return res.render('register', { errorMsg: 'Email already exists' });
        }

        // Increment the counter and generate the customer ID
        customerCounter++;
        const customerId = `CUST${customerCounter}`;

        // Insert the new customer into the database
        connection.query(
            'INSERT INTO customers (cust_id, email, password, username, f_name, l_name, gender, dob, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [customerId, email, password, username, null, null, null, null, null],
            (error, results) => {
                if (error) {
                    console.log(error);
                    return res.status(500).send('Error inserting customer');
                }
                res.redirect('/updateProfile');
            }
        );
    });
});


app.get('/updateProfile', (req, res) => {
    res.sendFile(path.join(__dirname, 'HTML', 'createTheForm.html'));
});

app.post('/updateProfile', encoder, (req, res) => {
    var email = req.body.email;
    var fname = req.body.firstName;
    var lname = req.body.lastName;
    var gender = req.body.gender;
    var dob = req.body.dob;
    var address = req.body.address;

    // Perform database update
    const query = 'UPDATE customers SET f_name = ?, l_name = ?, gender = ?, dob = ?, address = ? WHERE email = ?';
    connection.query(query, [fname, lname, gender, dob, address, email], (error, results) => {
        if (error) {
            console.error('Error updating data:', error);
            res.status(500).send('Error updating data in the database');
        } else {
            res.redirect('/login');
        }
    });
});

let storeOTP = '';

app.get('/forgotPassword', (req, res) => {
    res.render('forgetpassword', { errorMsg: null })
});

app.post('/forgotPassword', (req, res) => {
    var email = req.body.email;
    connection.query('SELECT * FROM customers WHERE email = ?', email, (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).send('Error');
        }
        if (results.length === 0) {
            res.render('forgetpassword', { errorMsg: 'Email not found' });
        }
        else {
            var otp = randomstring.generate({
                length: 6,
                charset: 'numeric'
            });

            storeOTP = otp;

            var mailOptions = {
                from: 'srivaths.iyer@gmail.com',
                to: email,
                subject: 'Password Reset OTP',
                text: 'Your OTP for password reset is: ' + otp
            };
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    console.log(error);
                    res.status(500).send('Error sending OTP');
                } else {
                    console.log('Email sent: ' + info.response);
                    res.render('otp',{errorMsg: null})
                }
            });
        }
    })
});

app.post('/otp',(req,res)=>{
    var otp=req.body.otp;
    if(otp===storeOTP){
        res.render('resetPassword',{errorMsg:null})
    }
    else{
        res.render('forgetpassword',{errorMsg:'Invalid OTP'});
    }
});

app.post('/resetPassword',(req,res)=>{
    var email = req.body.email;
    var password=req.body.password;
    var confirmPassword=req.body.c_password;
    if (password===confirmPassword) {
        connection.query('UPDATE customers set password=? where email=?',[password,email],(error,results)=>{
            if(error){
                res.status(500).send('Error');
                }
            else{
                res.render('login',{errorMsg:null});
            }
        })
    }
    else{
        res.render('resetPassword',{errorMsg:'Password and Confirm Password do not match'});
    }
})

app.get('/explore-cars', (req, res) => {
    connection.query('SELECT * from cars', (error, results) => {
        if (error) {
            console.log(error);
        }
        // console.log(results);
        res.render('explore_cars', { cars: results });
    })
});




app.get('/showroom-login', (req, res) => {
    res.render('showroom_login');
});

app.post('/showroom-login', encoder, (req, res) => {
    var email = req.body.email;
    var password = req.body.password;
    connection.query('SELECT * from showroom where email=? and showroom_pass=?', [email, password], (error, results) => {
        if (error) {
            res.send(error);
        }
        console.log(results);
        if (results.length > 0) {
            res.redirect(`/showroom-homepage?email=${encodeURIComponent(email)}`);
        } else {
            res.redirect('/showroom-login');
        }
        res.end();
    });
});

app.get('/showroom_register', (req, res) => {
    res.sendFile(path.join(__dirname, 'HTML', 'showroom_register.html'));
});

app.post('/showroom_register', (req, res) => {
    var username = req.body.username;
    var showname = req.body.showroom_name;
    var email = req.body.email;
    var password = req.body.password;
    var confirmpassword = req.body.cpassword;
    var address = req.body.address;

    if (password !== confirmpassword) {
        return res.status(400).json({ error: "Passwords do not match" });
    }
    customerCounter++;
    const showroonID = `SHOW${customerCounter}`

    connection.query("INSERT INTO showroom (showroom_id, showroom_username, showroom_name, email,showroom_pass, address) VALUES (?, ?, ?, ?, ?, ?)", [showroonID, username, showname, email, password, address], function (err, result) {
        if (err) {
            console.error("Error inserting into showroom table: ", err);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.redirect('/showroom-login')
    });
});


app.get('/showroom-homepage', (req, res) => {
    const userEmail = req.query.email;
    console.log("Email: " + userEmail);
    // res.session.showEmail= userEmail;
    connection.query('select showroom_id from showroom where email = ?', [userEmail], (error, results1) => {
        if (error) {
            console.log(error);
        }
        else {
            const showroomId = results1[0].showroom_id;
            const query = `SELECT sum(c.price) as total_sales, count(c.price) as total_orders
                from cars as c 
                    JOIN
                bookings as b 
                    on c.car_id = b.car_id
                where showroom_id = ?
            `;
            connection.query(query, [showroomId], (error, results2) => {
                if (error) {
                    console.log(error);
                }
                else {
                    const query2 = `
                    SELECT count(distinct cust_id) as total_customers
                        from 
                    bookings 
                        where showroom_id = ? 
                    group by showroom_id;
                    `;
                    connection.query(query2, [showroomId], (error, results3) => {
                        if (error) {
                            console.log(error);
                        }
                        else {
                            const { total_sales, total_orders } = results2[0];
                            const { total_customers } = results3[0];
                            const chartData = {
                                totalSales: total_sales,
                                totalCustomers: total_customers,
                                totalOrders: total_orders,
                            };
                            res.render('showroom-homepage', { chartData, email: userEmail });
                        }
                    });
                }
            });
        }
    });
});


app.get('/chart-data', (req, res) => {
    const email = req.query.email;
    // console.log(email);
    connection.query('select showroom_id from showroom where email = ?', [email], (error, results1) => {
        if (error) {
            console.log(error);
            res.status(500).json({ error: 'Internal Server Error' });
        } else {
            const showroomId = results1[0].showroom_id;
            const revenueQuery = `
            select month(booking_date) as month,
                sum(price) as revenue
            from cars as c 
                join bookings as b 
            on c.car_id = b.car_id 
                where showroom_id = ?
            group by month(booking_date)`;

            connection.query(revenueQuery, [showroomId], (revenueError, revenueResults) => {
                if (revenueError) {
                    console.error('Error fetching revenue and orders data from MySQL:', revenueError);
                    res.status(500).json({ error: 'Internal Server Error' });
                    return;
                }
                else {
                    const ordersQuery = `
                    select month(booking_date) as month,
                        count(car_id) as orders
                    from 
                        bookings 
                    where showroom_id=? 
                        group by month(booking_date);`
                    connection.query(ordersQuery, [showroomId], (ordersError, ordersResults) => {
                        if (ordersError) {
                            console.error('Error fetching revenue and orders data from MySQL:', ordersError);
                            res.status(500).json({ error: 'Internal Server Error' });
                        }
                        else {

                            console.log(ordersResults);
                            const chartData = {
                                Show_email: email,
                                months: revenueResults.map(result => result.month),
                                revenue: revenueResults.map(result => result.revenue),
                                orders: ordersResults.map(result => result.orders)
                            };

                            res.json(chartData);
                        }
                    });
                }
            });
        }
    });
});

app.use(express.json());
app.get('/searched_car', (req, res) => {
    const searchQuery = req.query.query;
    const carSearch = '%' + searchQuery + '%';
    console.log('Search query:', searchQuery);
    connection.query('SELECT * FROM cars WHERE car_name LIKE ?', [carSearch], (error, results) => {
        if (error) {
            console.error('Error in SQL query:', error);
            res.status(500).send('Error retrieving data');
        } else {
            console.log('Search results:', results);
            res.render('searched_car', { cars: results });
        }
    });
});

app.post('/homepage-search', encoder, (req, res) => {
    var { carModel, monthlyPay } = req.body;
    var carModel = '%' + carModel + '%';
    // console.log(carModel, monthlyPay);
    if (carModel.length === 0 && monthlyPay.length === 0) {
        res.redirect('/');
    } else {
        if (carModel.length !== 0 && monthlyPay.length === 0) {
            connection.query('SELECT * FROM cars WHERE car_name LIKE ?', [carModel], (error, results) => {
                if (error) {
                    console.error('Error in SQL query:', error);
                    res.status(500).send('Error retrieving data');
                } else {
                    res.render('searched_car', { cars: results });
                }
            })
        } else if (monthlyPay.length !== 0 && carModel.length === 0) {
            connection.query('SELECT * FROM cars WHERE price >= ?', [monthlyPay], (error, results) => {
                if (error) {
                    console.error('Error in SQL query:', error);
                    res.status(500).send('Error retrieving data');
                } else {
                    res.render('searched_car', { cars: results });
                }
            })
        }
        else {
            connection.query('SELECT * FROM cars WHERE price >= ? and car_name LIKE ?', [monthlyPay, carModel], (error, results) => {
                if (error) {
                    console.error('Error in SQL query:', error);
                    res.status(500).send('Error retrieving data');
                } else {
                    res.render('searched_car', { cars: results });
                }
            });
        }
    }
});

app.get('/branded-cars', (req, res) => {
    var brand = req.query.brand;
    brand = '%' + brand + '%';
    console.log(brand);
    connection.query('SELECT * FROM cars WHERE car_name LIKE ?', [brand], (error, results) => {
        if (error) {
            console.error('Error in SQL query:', error);
            res.status(500).send('Error retrieving data');
        } else {
            res.render('searched_car', { cars: results });
        }
    });
});


app.get('/car_page', (req, res) => {
    const car_id = req.query.car_id;
    console.log(car_id)
    if (!car_id) {
        res.status(400).send('Car ID is required');
        return;
    }

    const carQuery = `SELECT * FROM cars WHERE car_id = ?;`;
    const showroomQuery = `
    SELECT s.showroom_id, s.showroom_name, s.email, s.address 
    FROM carshow as cs
    JOIN showroom as s ON cs.showroom_id = s.showroom_id 
    WHERE cs.car_id = ?
    GROUP BY s.showroom_id, s.showroom_name, s.email, s.address;
`;

    connection.query(carQuery, [car_id], (carError, carResults) => {
        if (carError) {
            console.error('Error executing car query:', carError);
            res.status(500).send('Error retrieving car data');
            return;
        }
        // console.log(carResults);
        if (carResults.length === 0) {
            res.status(404).send('Car not found');
            return;
        }

        connection.query(showroomQuery, [car_id], (showroomError, showroomResults) => {
            if (showroomError) {
                console.error('Error executing showroom query:', showroomError);
                res.status(500).send('Error retrieving showroom data');
                return;
            }

            const combinedResults = {
                car: carResults[0],
                showroom: showroomResults
            };

            console.log(combinedResults);
            const cars = carResults[0];
            const showroom = showroomResults;
            res.render('product', { car: cars, showroom: showroom });
        });
    });
});


app.get('/addCar', (req, res) => {
    let email = req.query.email;
    console.log("Yahan Email hain: " + email);
    connection.query('SELECT showroom_id FROM showroom WHERE email = ?', [email], (error, results) => {
        if (error) {
            console.log(error);
        }
        const showroomId = results[0].showroom_id;
        connection.query('select * from cars natural join carshow where showroom_id = ?;', [showroomId], (error, results1) => {
            if (error) {
                console.log(error);
            }
            else {
                res.render('addCar', { cars: results1, showroom_id: showroomId, showroom_email: email });
            }
        });
    });
});

app.get('/addCarForm', (req, res) => {
    const showroom_id = req.query.showroom_id;
    const showroom_email = req.query.showroom_email;
    res.render('addCarForm', { showroom_id: showroom_id, showroom_email: showroom_email });
});

const uploadDir = 'UPLOADS';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }   
});

const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post('/addCarForm', upload.single('carImage'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const imageFileName = req.file.filename; // Get original filename
    const imagecode = imageFileName.substring(0, imageFileName.lastIndexOf('.'));
    const show_id = req.body.showroom_id[0];
    console.log(show_id);
    const showEmail = req.body.showroom_id[1];
    console.log(showEmail);
    const car_name = req.body.car_name;
    const mileage = req.body.mileage;
    const topspeed = req.body.topspeed;
    const yearman = req.body.year;
    const airbags = req.body.airbags;
    const capacity = req.body.capacity;
    const price = req.body.price;
    const mrp = req.body.mrp;

    connection.query('SELECT car_id from cars where car_name = ?', [car_name], (error, results) => {
        if (results.length > 0) {
            const carid = results[0].car_id;
            const carsold = 0;
            connection.query('INSERT into carshow(car_id, showroom_id, cars_sold) values(?, ?, ?)', [carid, show_id, carsold], (error, dResults) => {
                if (error) {
                    console.log(error);
                    return res.status(500).send('Error');
                }
                else {
                    res.redirect('/addCar');
                }
            });
        }
        else {
            ++customerCounter;
            const carId = `CAR${customerCounter}`;
            connection.query('INSERT into cars(car_id, car_name, mileage, topspeed, capacity, year_man, airbags, price, mrp, imagecode) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [carId, car_name, mileage, topspeed, capacity, yearman, airbags, price, mrp, imagecode], (error, carResults) => {
                if (error) {
                    console.log(error);
                    return res.status(500).send('Error');
                }
                else {
                    connection.query('INSERT into carshow(car_id, showroom_id, cars_sold) values(?, ?, ?)', [carId, show_id, 0], (error, dResults) => {
                        if (error) {
                            console.log(error);
                            return res.status(500).send('Error');
                        }
                        else {
                            res.redirect(`/showroom-homepage?email=${encodeURIComponent(showEmail)}`);
                        }
                    });

                }
            });
        }
    });
});


app.get('/bookingForm', (req, res) => {
    const carID = req.query.carID;
    const showQuery = `
        SELECT DISTINCT cs.*, s.*
        FROM carshow AS cs
        JOIN showroom AS s ON cs.showroom_id = s.showroom_id
        WHERE cs.car_id = ?;
    `;
    connection.query(showQuery, [carID], (error, showResults) => {
        if (error) {
            console.log(error);
            return res.status(500).send('Error');
        } else {
            // Assuming customerID is available, for demonstration purposes, it's set to 1
            const customerID = 1; // Replace with actual customer ID fetching logic
            res.render('bookingForm', { showrooms: showResults, carID: carID });
        }
    });
});

app.post('/bookingForm', (req, res) => {
    const email = req.body.email;
    const carID = req.body.car_id;
    const showroomID = req.body.showroom_id;
    const bookingDate = new Date();

    const insertBookingQuery = `
        INSERT INTO bookings (car_id, cust_id, showroom_id, booking_date)
        VALUES (?, ?, ?, ?)
    `;
    connection.query('select cust_id from customers where email = ?', [email], (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).send('Error');
        } else {
            const customerID = results[0].cust_id;
            connection.query(insertBookingQuery, [carID, customerID, showroomID, bookingDate], (error, results) => {
                if (error) {
                    console.log(error);
                    return res.status(500).send('Error');
                } else {
                    const mailOptions = {
                        from: 'srivaths.iyer@gmail.com',
                        to: email,
                        subject: 'Car Booking Confirmation',
                        text: 'Your car has been booked successfully!'
                    };

                    // Send the email
                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.log(error);
                            return res.status(500).send('Error sending email');
                        } else {
                            console.log('Email sent: ' + info.response);
                            res.redirect('/'); // Redirect to a success page or the desired location
                        }
                    });
                }
            });
        }
    })
});


app.get('/booking', (req, res) => {
    const username = req.query.username;
    console.log(username);
    // Assuming you pass username as query parameter
    // Query to retrieve cust_id using username
    const custIdQuery = "SELECT cust_id FROM customers WHERE username = ?";

    connection.query(custIdQuery, [username], (error, results) => {
        if (error) {
            console.error("Error retrieving cust_id:", error);
            return res.status(500).send('Error retrieving cust_id');
        }

        if (results.length === 0) {
            return res.status(404).send('Customer not found');
        }

        const cust_id = results[0].cust_id;
        console.log("cust: " + cust_id)
        // Query to fetch bookings associated with the customer
        const bookQuery = `
            SELECT c.car_id, c.car_name, c.mileage, c.capacity, c.topspeed, 
                   c.price, c.rating, c.year_man, c.airbags, c.colors, c.imagecode, 
                   c.reviews, c.mrp
            FROM cars c
            JOIN bookings b ON c.car_id = b.car_id
            WHERE b.cust_id = ?
            GROUP BY c.car_id, c.car_name, c.mileage, c.capacity, c.topspeed, 
                     c.price, c.rating, c.year_man, c.airbags, c.colors, c.imagecode, 
                     c.reviews, c.mrp;
        `;

        connection.query(bookQuery, [cust_id], (err, bookings) => {
            if (err) {
                console.error("Error fetching bookings:", err);
                return res.status(500).send('Error fetching bookings');
            }

            // Render your booking page with the fetched bookings data
            res.render('booking', { cars: bookings });
        });
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
