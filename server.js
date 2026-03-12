let http = require('http');
// local
let { Pool } = require('pg');
const admin = require('firebase-admin');



// production setup
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// prod database connection

// const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});


// local setup
// const serviceAccount = require('./serviceAccountKey.json');
// Initialize Firebase Admin

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// local database connection

// let pool = new Pool({
//     user: "postgres",
//     host: "localhost",
//     database: "DMS",
//     password: "admin",
//     port: 5432
// })



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

    req.on('data', chunk => {
        body += chunk.toString();
    });

    let role = 'user';

    req.on('end', async () => {
        let data = JSON.parse(body);

        let result = await pool.query(
            'INSERT INTO users(name,email,password,phone,role,user_img) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
            [data.name, data.email, data.password, data.phone, role, data.user_img]
        );

        res.end(
            JSON.stringify({
                status: 200,
                response: true,
                data: result.rows[0]
            })
        );
    });
}
    // user login
  else if (req.url == '/login' && req.method == 'POST') {

    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {

        try {

            let data = JSON.parse(body);

            let result = await pool.query(
                'SELECT * FROM users WHERE email=$1 AND password=$2',
                [data.email, data.password]
            );

            if (result.rows.length === 0) {
                res.end(JSON.stringify({
                    status:401,
                    response:false,
                    message:"Invalid email or password"
                }));
                return;
            }

            let user = result.rows[0];

            if (user.user_img && Buffer.isBuffer(user.user_img)) {
                user.user_img = user.user_img.toString('base64');
            }

            res.end(JSON.stringify({
                status:200,
                response:true,
                data:user
            }));

        } catch(err) {

            console.log("LOGIN ERROR:", err);

            res.end(JSON.stringify({
                status:500,
                message:"Server error"
            }));

        }

    });

}

    // get all users
    else if (req.url == '/getUsers' && req.method == 'GET') {
        let result = await pool.query(`
            SELECT 
                u.*, 
                COUNT(o.id) as total_orders, 
                COALESCE(SUM(o.total_price), 0) as total_spent 
            FROM users u 
            LEFT JOIN orders o ON u.id = o.user_id 
            GROUP BY u.id
            ORDER BY u.id DESC
        `);
        // badse to convert image buffer to base64 string
        let users = result.rows.map(user => {
            if (user.user_img && Buffer.isBuffer(user.user_img)) {
                user.user_img = user.user_img.toString('base64');
            }
            // format total_orders to number
            user.total_orders = parseInt(user.total_orders, 10);
            // format total_spent to a number to easily show on frontend
            user.total_spent = parseFloat(user.total_spent).toFixed(2);
            return user;
        });
        res.end(
            JSON.stringify(
                {
                    status: 200,
                    response: 'true',
                    data: users
                }
            )
        )
    }
    // update user profile
    else if (req.url == '/updateProfile' && req.method == 'PATCH') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        }); 
        req.on('end', async () => {
            try {
                let data = JSON.parse(body);
                
                let imageBuffer = null;
                if (data.user_img) {
                    if (data.user_img.includes(';base64,')) {
                        const base64Data = data.user_img.split(';base64,').pop();
                        imageBuffer = Buffer.from(base64Data, 'base64');
                    } else {
                        imageBuffer = Buffer.from(data.user_img, 'base64');
                    }
                }

                let result = await pool.query(
                    'UPDATE users SET user_img=$1 WHERE id=$2 RETURNING *',
                    [imageBuffer, data.id]
                );

                if (result.rows.length === 0) {
                    res.end(JSON.stringify({ status: 404, success: false, message: 'User not found' }));
                    return;
                }

                let updatedUser = result.rows[0];
                if (updatedUser.user_img && Buffer.isBuffer(updatedUser.user_img)) {
                    updatedUser.user_img = updatedUser.user_img.toString('base64');
                }

                res.end(
                    JSON.stringify({
                        status: 200,
                        success: true,
                        message: "user profile updated succesfully",
                        data: updatedUser
                    })
                );
            } catch (err) {
                console.log(err);
                res.end(JSON.stringify({ status: 500, success: false, message: "Server error" }));
            }
        });
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
    // update a product completely
    else if (req.url == '/updateProduct' && req.method == 'PATCH') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                let data = JSON.parse(body);
                let result = await pool.query(
                    'UPDATE products SET name=$1, description=$2, price=$3, stock=$4, category=$5, image_url=$6 WHERE id=$7 RETURNING *',
                    [data.name, data.description, data.price, data.stock, data.category, data.image_url, data.id]
                );

                if (result.rows.length === 0) {
                    res.end(JSON.stringify({ status: 404, response: false, message: 'Product not found' }));
                    return;
                }

                res.end(JSON.stringify({
                    status: 200,
                    response: true,
                    data: result.rows[0],
                    message: "Product updated successfully"
                }));
            } catch (err) {
                console.log("UPDATE PRODUCT ERROR:", err);
                res.end(JSON.stringify({ status: 500, response: false, message: "Server error" }));
            }
        });
    }
    // update product stock
    else if (req.url == '/updateStock' && req.method == 'PATCH') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                let data = JSON.parse(body);
                let result = await pool.query(
                    'UPDATE products SET stock=$1 WHERE id=$2 RETURNING *',
                    [data.stock, data.id]
                );

                if (result.rows.length === 0) {
                    res.end(JSON.stringify({ status: 404, response: false, message: 'Product not found' }));
                    return;
                }

                res.end(JSON.stringify({
                    status: 200,
                    response: true,
                    data: result.rows[0],
                    message: "Stock updated successfully"
                }));
            } catch (err) {
                console.log("UPDATE STOCK ERROR:", err);
                res.end(JSON.stringify({ status: 500, response: false, message: "Server error" }));
            }
        });
    }
    // place order
  else if (req.url == '/placeOrder' && req.method == 'POST') {

let body = '';

req.on('data', chunk => {
    body += chunk.toString();
});

req.on('end', async () => {

    try {

        let data = JSON.parse(body);

        // 1️⃣ Get product stock
        let productResult = await pool.query(
            'SELECT stock FROM products WHERE id=$1',
            [data.product_id]
        );

        if (productResult.rows.length === 0) {
            res.end(JSON.stringify({
                status:404,
                response:false,
                message:"Product not found"
            }));
            return;
        }

        let currentStock = productResult.rows[0].stock;

        // 2️⃣ Check stock availability
        if (currentStock < data.quantity) {

            res.end(JSON.stringify({
                status:400,
                response:false,
                message:"Product is out of stock"
            }));

            return;
        }

        // 3️⃣ Insert order
        let result = await pool.query(
            `INSERT INTO orders(user_id,user_name,product_id,product_name,quantity,total_price)
             VALUES($1,$2,$3,$4,$5,$6)
             RETURNING *`,
            [
                data.user_id,
                data.user_name,
                data.product_id,
                data.product_name,
                data.quantity,
                data.total_price
            ]
        );

        // 4️⃣ Reduce product stock
        let newStock = currentStock - data.quantity;

        await pool.query(
            'UPDATE products SET stock=$1 WHERE id=$2',
            [newStock, data.product_id]
        );

        // 5️⃣ Get user FCM token
        let tokenResult = await pool.query(
            'SELECT user_fcm FROM usersfcmtoken WHERE user_id=$1',
            [data.user_id]
        );

        // 6️⃣ Get admin FCM token
        let adminTokenResult = await pool.query(
            'SELECT user_fcm FROM usersfcmtoken WHERE user_id IN (SELECT id FROM users WHERE role=$1)',
            ['admin']
        );

        // 7️⃣ Send notification to admin
        if (adminTokenResult.rows.length > 0) {

            let adminFcmToken = adminTokenResult.rows[0].user_fcm;

            let message = {
                notification: {
                    title: "New Order Placed",
                    body: `You have a new order from ${data.user_name} for ${data.product_name}`
                },
                token: adminFcmToken
            };

            try {
                await admin.messaging().send(message);
                console.log("Admin FCM notification sent");
            } catch (err) {
                console.log("Admin FCM error:", err);
            }
        }

        // 8️⃣ Send notification to user
        if (tokenResult.rows.length > 0) {

            let userFcmToken = tokenResult.rows[0].user_fcm;

            let message = {
                notification: {
                    title: "Order Placed",
                    body: `Your order ${result.rows[0].id} has been placed successfully!`
                },
                token: userFcmToken
            };

            try {
                await admin.messaging().send(message);
                console.log("User FCM notification sent");
            } catch (err) {
                console.log("User FCM error:", err);
            }
        }

        // 9️⃣ Response
        res.end(JSON.stringify({
            status:200,
            response:true,
            data: result.rows[0]
        }));

    } catch(err) {

        console.log("ORDER ERROR:", err);

        res.end(JSON.stringify({
            status:500,
            response:false,
            message:"Server error"
        }));

    }

});

}
    // user changing order status
else if (req.url == '/updateOrder' && req.method == 'PATCH') {

    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {

        let data = JSON.parse(body);
        let id = data.id;

        let result = await pool.query(
            'UPDATE orders SET quantity=$1 WHERE id=$2 RETURNING *',
            [data.quantity, id]
        );

        if (result.rows.length === 0) {

            res.end(JSON.stringify({
                status: 404,
                response: false,
                message: 'Order not found'
            }));

            return;
        }

        // Get FCM token
        let tokenResult = await pool.query(
            'SELECT user_fcm FROM usersfcmtoken WHERE user_id=$1',
            [data.user_id]
        );

        if (tokenResult.rows.length > 0) {

            let userFcmToken = tokenResult.rows[0].user_fcm;

            let message = {
                notification: {
                    title: "Order Updated",
                    body: `Your order ${id} quantity updated to ${data.quantity}`
                },
                token: userFcmToken
            };

            try {
                await admin.messaging().send(message);
                console.log("FCM notification sent");
            } catch (err) {
                console.log("FCM error:", err);
            }
        }

        res.end(JSON.stringify({
            status: 200,
            response: true,
            data: result.rows[0]
        }));

    });
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

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {

        let data = JSON.parse(body);

        let result = await pool.query(
            'UPDATE orders SET order_status=$1 WHERE id=$2 AND user_id=$3 RETURNING *',
            [data.order_status, data.id, data.user_id]
        );

        let tokenResult = await pool.query(
            'SELECT user_fcm FROM usersfcmtoken WHERE user_id=$1',
            [data.user_id]
        );

        let product_name = await pool.query('SELECT product_name FROM orders WHERE id=$1 AND user_id=$2', [data.id, data.user_id]);
        if (tokenResult.rows.length > 0) {

            let userFcmToken = tokenResult.rows[0].user_fcm;
            // just iocns for different order status take emojis as icons for different order status placed packed shipped delivered 
            let orderstatus_icon=['📦', '🕒', '🚚', '✅'];
            let ordericon = orderstatus_icon[0]; // default icon
            switch(data.order_status){
                case 'placed':
                    ordericon = '📦';
                    break;
                case 'packed':
                    ordericon = '🕒';
                    break;
                case 'shipped':
                    ordericon = '🚚';
                    break;
            }

            let message = {
                notification: {
                    title: "Order Status Updated",
                    body: `${ordericon} Your order for ${product_name.rows[0].product_name} has been ${data.order_status}`
                },
                token: userFcmToken
            };

            try {
                await admin.messaging().send(message);
                console.log("FCM notification sent");
            }
            catch (err) {
                console.log("FCM error:", err);
            }

        }

        res.end(JSON.stringify({
            status: 200,
            response: true,
            data: result.rows[0]
        }));

    });

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
            // update wishlist status in products table
            await pool.query('UPDATE products SET wishlist_status=true WHERE id=$1', [data.pid]);
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
        // badse to convert image buffer to base64 string
          let wishlistItems = result.rows.map(product => {
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
                    data: wishlistItems
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
        // badse to convert image buffer to base64 string
           let cartItems = result.rows.map(product => {
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
                    data: cartItems
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
else if(req.url == '/save-token' && req.method == 'POST'){
    let body = '';
    console.log("Saving token...");

    req.on('data', chunk => {
        body += chunk.toString();
    });
    console.log(body)

    req.on('end', async () => {
        try{
            let data = JSON.parse(body);
            console.log(data)

            let result = await pool.query(
                `INSERT INTO usersfcmtoken(user_id,user_fcm)
                 VALUES($1,$2)
                 ON CONFLICT (user_id)
                 DO UPDATE SET user_fcm = EXCLUDED.user_fcm
                 RETURNING *`,
                [data.user_id, data.user_fcm]
            );

            res.end(JSON.stringify({
                status:200,
                response:true,
                data: result.rows[0]
            }));

        }catch(err){
            console.log(err);
            res.end(JSON.stringify({
                status:500,
                message:"Server error"
            }));
        }
    })
}


}).listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
})