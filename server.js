let http = require('http');
// local
// let { Pool } = require('pg');

// let pool = new Pool({
//     user: "postgres",
//     host: "localhost",
//     database: "DMS",
//     password: "admin",
//     port: 5432
// })

// prod

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const PORT = process.env.PORT || 3000;


http.createServer(async (req, res) => {

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    res.setHeader("Content-Type", "application/json");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }
    // user registration
    if (req.url == '/userRegestration' && req.method == 'POST') {
        let body = '';

        req.on('data', chunck => {
            body += chunck.toString();
        })
        let role = 'user';
        req.on('end', async () => {
            let data = JSON.parse(body);
            let result = await pool.query('INSERT INTO users(name,email,password,phone,role,user_img)',
                [body.name, body.email, body.password, body.phone, role, body.user_img]
            );

            res.end(
                JSON.stringify(
                    {
                        status: 200,
                        response: "true",
                        data: result.rows
                    }
                )
            )
        })
    }
    // user login
    else if (req.url == '/login' && req.method == 'POST') {
        let body = '';
        req.on('data', chucnk => {
            body += chucnk
        })

        req.on('end', async () => {
            let data = JSON.parse(body);
            console.log(data)
            let result = await pool.query('SELECT * FROM users WHERE email=$1 AND password=$2 ', [data.email, data.password]);
            console.log(result)
            res.end(
                JSON.stringify(
                    {
                        status: 200,
                        response: 'true',
                        data: result.rows
                    }
                )
            )
        })
    }

    // get all users
    else if (req.url == '/getUsers' && req.method == 'GET') {
        let result = await pool.query('SELECT * FROM users');
        res.end(
            JSON.stringify(
                {
                    status: 200,
                    response: 'true',
                    data: result.rows
                }
            )
        )
    }
    // getting all products
    else if (req.url == '/getProducts' && req.method == 'GET') {
        let result = await pool.query('SELECT * FROM products');
        // FIX: Removed .toString('base64') which was corrupting Data URLs. 
        // These are already stored as base64/Data URLs in the DB.
        let products = result.rows.map(product => {
            if (product.image_url && Buffer.isBuffer(product.image_url)) {
                product.image_url = product.image_url.toString();
            }
            return product;
        });
        res.end(
            JSON.stringify(
                {
                    status: 200,
                    response: 'true',
                    data: products
                }
            )
        )
    }
    // to get a perticular product
    else if (req.method == 'GET' && req.url.startsWith('/getProduct/')) {
        let id = req.url.split('/')[2];
        let result = await pool.query('SELECT * FROM products WHERE id=$1', [id]);
        let product = result.rows[0];
        if (product && product.image_url && Buffer.isBuffer(product.image_url)) {
            product.image_url = product.image_url.toString();
        }

        res.end(
            JSON.stringify(
                {
                    status: 200,
                    response: "true",
                    data: product
                }
            )
        )
    }
    else if (req.url == "/addProduct" && req.method == "POST") {
        let body = '';
        req.on('data', chunck => {
            body += chunck.toString()
        })
        console.log("working");
        console.log(body);

        req.on('end', async () => {
            let data = JSON.parse(body);
            console.log(data);
            let result = await pool.query('INSERT into products(name,description,price,stock,category,image_url) VALUES($1,$2,$3,$4,$5,$6)', [data.name, data.description, data.price, data.stock, data.category, data.image_url]);

            res.end(
                JSON.stringify(
                    {
                        status: 200,
                        response: 'True',
                        data: result.rows[0]
                    }
                )
            )
        })
    }
    // place order
    else if (req.url == '/placeOrder' && req.method == 'POST') {
        let body = '';

        req.on('data', chucnk => {
            body += chucnk
            console.log(body)
        })


        // checking if the product is in stock
        req.on('end', async () => {
            let data = JSON.parse(body);
            // let result = await pool.query('SELECT stock FROM products WHERE id=$1 ',[data.product_id]);
            // if(result.rows[0].stock < data.quantity){
            //     res.end(    
            //         JSON.stringify(
            //             {
            //                 status:400,
            //                 response:'false',
            //                 message:'Product is out of stock'
            //             }
            //         )
            //     )
            // }
            // else{
            // 
            // reducing the stock of the product
            // let newStock = result.rows[0].stock - data.quantity;
            // await pool.query('UPDATE products SET stock=$1 WHERE id=$2',[newStock,data.product_id]);

            // inserting the order
            let result = await pool.query('INSERT INTO orders(user_id, user_name, product_id, product_name, quantity, total_price) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
                [data.user_id, data.user_name, data.product_id, data.product_name, data.quantity, data.total_price]
            );


            res.end(
                JSON.stringify(
                    {
                        status: 200,
                        response: 'true',
                        data: result.rows[0]
                    }
                )
            )
            // }
        })
    }
    // user changing order status
    else if (req.url == '/updateOrder' && req.method == 'PATCH') {
        let body = '';
        req.on('data', chucnk => {
            body += chucnk.toString();
        })
        req.on('end', async () => {
            let data = JSON.parse(body);
            let id = data.id;
            // if (data.quantity) {
                let result = await pool.query('UPDATE orders SET quantity=$1 WHERE id=$2 RETURNING *',
                    [data.quantity, id]
                )

                console.log(result.rows[0])
                // res.writeHead(200);
                res.end(
                    JSON.stringify(
                        {
                            status: 201,
                            response: 'success',
                            data: result.rows[0]
                        }
                    )
                )
            // }
        })
    }
    // getting all orders

    else if (req.method == 'GET' && req.url.startsWith('/getOrders/')) {
        let id = req.url.split('/')[2];
        let result = await pool.query('SELECT * FROM orders WHERE user_id=$1', [id]);
        res.end(
            JSON.stringify(
                {
                    status: 200,
                    response: "True",
                    data: result.rows
                }
            )
        )
    }

    // get all orders for admin
    else if (req.url == '/getAllOrders' && req.method == 'GET') {
        let result = await pool.query('SELECT * FROM orders');
        res.end(
            JSON.stringify(
                {
                    status: 200,
                    response: 'true',
                    data: result.rows
                }
            )
        )
    }

    // admin changing order status
    else if (req.url == '/updateOrderStatus' && req.method == 'PATCH') {
        let body = '';
        req.on('data', chucnk => {
            body += chucnk.toString();
        })
        console.log(body)
        req.on('end', async () => {
            let data = JSON.parse(body);
            console.log(data)
            let result = await pool.query('UPDATE orders SET order_status=$1 WHERE id=$2 AND user_id=$3', [data.order_status, data.id, data.user_id]);
            res.end(
                JSON.stringify(
                    {
                        status: 200,
                        response: 'true',
                        data: result.rows[0]
                    }
                )
            )
        })
    }
    // add to wish list
    else if (req.url == '/addToWishlist' && req.method == 'POST') {
        let body = '';
        req.on('data', chucnk => {
            body += chucnk.toString();
        })
        req.on('end', async () => {
            let data = JSON.parse(body);
            let result = await pool.query('INSERT INTO wishlist(pid, name,price, category,image_url,user_id,stock) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [data.pid, data.name, data.price, data.category, data.image_url, data.user_id, data.stock]);
            res.end(
                JSON.stringify(
                    {
                        status: 200,
                        response: 'true',
                        data: result.rows[0]
                    }
                )
            )
        })
    }
    else if (req.method == 'GET' && req.url.startsWith('/getWishlist/')) {
        let id = req.url.split('/')[2];
        let result = await pool.query('SELECT * FROM wishlist WHERE user_id=$1', [id]);
        res.end(
            JSON.stringify(
                {
                    status: 200,
                    response: 'true',
                    data: result.rows
                }
            )
        )
    }

    // add to cart
    else if (req.url == '/addToCart' && req.method == 'POST') {
        let body = '';
        req.on('data', chucnk => {
            body += chucnk.toString();
        })
        req.on('end', async () => {
            let data = JSON.parse(body);
            let result = await pool.query('INSERT INTO cart( pid, name,price, category,image_url,stock,user_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [data.pid, data.name, data.price, data.category, data.image_url, data.stock, data.user_id]);
            res.end(
                JSON.stringify(
                    {
                        status: 200,
                        response: 'true',
                        data: result.rows[0]
                    }
                )
            )
        })
    }
    else if (req.method == 'GET' && req.url.startsWith('/getCart/')) {
        let id = req.url.split('/')[2];
        let result = await pool.query('SELECT * FROM cart WHERE user_id=$1', [id]);
        res.end(
            JSON.stringify(
                {
                    status: 200,
                    response: 'true',
                    data: result.rows
                }
            )
        )
    }

    // remove from cart
    else if (req.method == 'DELETE' && req.url.startsWith('/removeFromCart/')) {
        let id = req.url.split('/')[2];
        let result = await pool.query('DELETE FROM cart WHERE id=$1', [id]);
        res.end(
            JSON.stringify(
                {
                    status: 200,
                    response: 'true',
                    data: result.rows[0]
                }
            )
        )
    }
    // remove from wishlist
    else if (req.method == 'DELETE' && req.url.startsWith('/removeFromWishlist/')) {
        let id = req.url.split('/')[2];
        let result = await pool.query('DELETE FROM wishlist WHERE id=$1', [id]);
        res.end(
            JSON.stringify(
                {
                    status: 200,
                    response: 'true',
                    data: result.rows[0]
                }
            )
        )
    }


}).listen(3001, PORT, () => {
  console.log("Server running on port", PORT);
})