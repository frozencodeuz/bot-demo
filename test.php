<?php
header('Content-Type: application/json');

// Request methodni olish
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // GET uchun javob
    $response = [
        "method" => "GET",
        "message" => "Hello from GET",
        "time" => date("Y-m-d H:i:s")
    ];

    echo json_encode($response);
}

// POST uchun
elseif ($method === 'POST') {
    // JSON bodyni olish
    $input = json_decode(file_get_contents("php://input"), true);

    $response = [
        "method" => "POST",
        "message" => "Hello from POST",
        "your_data" => $input
    ];

    echo json_encode($response);
}

// Boshqa methodlar uchun
else {
    http_response_code(405);
    echo json_encode([
        "error" => "Method Not Allowed"
    ]);
}
