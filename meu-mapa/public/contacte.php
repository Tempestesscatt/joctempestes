<?php
// ============================================================
// contacte.php - Processa el formulari de contacte
// ============================================================

if ($_SERVER["REQUEST_METHOD"] == "POST") {

    // Recollir i netejar les dades
    $name = trim(htmlspecialchars($_POST['name'] ?? ''));
    $email = trim(htmlspecialchars($_POST['email'] ?? ''));
    $message = trim(htmlspecialchars($_POST['message'] ?? ''));
    $privacy = isset($_POST['privacy']) ? true : false;

    // Validar que no estiguin buits
    if (empty($name) || empty($email) || empty($message)) {
        $error = "Si us plau, omple tots els camps.";
        include 'contacte_form.php';
        exit;
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = "Si us plau, introdueix un correu electrònic vàlid.";
        include 'contacte_form.php';
        exit;
    }

    if (!$privacy) {
        $error = "Has d'acceptar la política de privacitat.";
        include 'contacte_form.php';
        exit;
    }

    // Destinatari
    $to = "meteomaresme@gmail.com";
    $subject = "Nou missatge de " . $name . " des de TEMPESTES.CAT";

    // Cos del missatge
    $body = "========================================\n";
    $body .= "Nou missatge de contacte - TEMPESTES.CAT\n";
    $body .= "========================================\n\n";
    $body .= "Nom:    " . $name . "\n";
    $body .= "Email:  " . $email . "\n";
    $body .= "Data:   " . date('d/m/Y H:i:s') . "\n";
    $body .= "IP:     " . $_SERVER['REMOTE_ADDR'] . "\n\n";
    $body .= "----------------------------------------\n";
    $body .= "Missatge:\n";
    $body .= "----------------------------------------\n";
    $body .= $message . "\n\n";
    $body .= "----------------------------------------\n";
    $body .= "Respon a: " . $email . "\n";

    // Capçaleres
    $headers = "From: " . $email . "\r\n";
    $headers .= "Reply-To: " . $email . "\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

    // Enviar correu
    if (mail($to, $subject, $body, $headers)) {
        $success = true;
        $message_text = "✅ Missatge enviat correctament! Et respondrem en 24h.";
    } else {
        $error = "❌ Error en enviar el missatge. Si us plau, torna a provar o escriu-nos directament a meteomaresme@gmail.com";
    }

    // Mostrar resultat
    include 'contacte_form.php';
    exit;
}

// Si no és POST, mostrar el formulari
include 'contacte_form.php';
?>