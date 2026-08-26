<!DOCTYPE html>
<html lang="ca">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contacte · TEMPESTES.CAT</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: #f5f4f0;
            color: #131313;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .contact-box {
            background: #ffffff;
            border-radius: 14px;
            padding: 40px 44px;
            max-width: 580px;
            width: 100%;
            box-shadow: 0 8px 40px rgba(11, 31, 50, 0.10);
            border: 1px solid #e0dcd4;
        }
        .contact-box h1 {
            font-size: 26px;
            font-weight: 800;
            color: #152c44;
            margin-bottom: 4px;
        }
        .contact-box .subtitle {
            color: #6b7a8f;
            font-size: 15px;
            margin-bottom: 24px;
        }
        .contact-box .field {
            margin-bottom: 16px;
        }
        .contact-box label {
            display: block;
            font-weight: 600;
            font-size: 14px;
            color: #152c44;
            margin-bottom: 4px;
        }
        .contact-box input,
        .contact-box textarea {
            width: 100%;
            padding: 12px 16px;
            border: 1px solid #e0dcd4;
            border-radius: 10px;
            font-family: inherit;
            font-size: 14px;
            transition: border-color 0.2s;
            background: #fafaf8;
        }
        .contact-box input:focus,
        .contact-box textarea:focus {
            outline: none;
            border-color: #152c44;
        }
        .contact-box textarea {
            resize: vertical;
            min-height: 100px;
        }
        .contact-box .checkbox-wrap {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin: 16px 0 20px;
        }
        .contact-box .checkbox-wrap input[type="checkbox"] {
            width: 18px;
            height: 18px;
            flex-shrink: 0;
            margin-top: 3px;
            accent-color: #152c44;
        }
        .contact-box .checkbox-wrap label {
            font-size: 13px;
            color: #555;
            font-weight: 400;
            line-height: 1.5;
        }
        .contact-box .checkbox-wrap a {
            color: #0058EE;
            text-decoration: underline;
        }
        .contact-box .submit-btn {
            width: 100%;
            padding: 14px;
            background: #152c44;
            border: none;
            color: #fff;
            font-weight: 700;
            font-size: 16px;
            border-radius: 30px;
            transition: background 0.2s;
            cursor: pointer;
        }
        .contact-box .submit-btn:hover {
            background: #0b1f32;
        }
        .contact-box .submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        .feedback {
            margin-top: 16px;
            padding: 14px 18px;
            border-radius: 10px;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            display: <?php echo (isset($success) || isset($error)) ? 'block' : 'none'; ?>;
        }
        .feedback.success {
            background: #e8f5e9;
            color: #2e7d32;
            border: 1px solid #a5d6a7;
        }
        .feedback.error {
            background: #fce4ec;
            color: #c62828;
            border: 1px solid #ef9a9a;
        }
        .contact-email {
            font-size: 13px;
            color: #888;
            text-align: center;
            margin-top: 14px;
        }
        .contact-email a {
            color: #0058EE;
        }
        .back-link {
            display: inline-block;
            margin-top: 16px;
            color: #6b7a8f;
            font-size: 13px;
            text-decoration: none;
            transition: color 0.2s;
        }
        .back-link:hover {
            color: #152c44;
        }
        .back-link i {
            margin-right: 6px;
        }
        @media (max-width: 600px) {
            .contact-box { padding: 24px 20px; }
        }
    </style>
</head>
<body>

    <div class="contact-box">
        <h1>TEMPESTES.CAT</h1>
        <p class="subtitle">Tens alguna pregunta o suggeriment? Escriu-nos!</p>

        <?php if (isset($success) && $success): ?>
            <div class="feedback success">
                <i class="fa-regular fa-circle-check"></i> <?php echo $message_text; ?>
            </div>
            <div style="text-align:center;margin-top:12px;">
                <a href="index.html" class="back-link"><i class="fa-solid fa-arrow-left"></i> Tornar a la pàgina principal</a>
            </div>
        <?php elseif (isset($error)): ?>
            <div class="feedback error">
                <i class="fa-regular fa-circle-xmark"></i> <?php echo $error; ?>
            </div>
            <div style="text-align:center;margin-top:12px;">
                <a href="contacte.php" class="back-link"><i class="fa-solid fa-arrow-left"></i> Tornar al formulari</a>
            </div>
        <?php else: ?>

            <form action="contacte.php" method="POST" id="contactForm">
                <div class="field">
                    <label>El teu nom</label>
                    <input type="text" name="name" id="contactName" required value="<?php echo htmlspecialchars($_POST['name'] ?? ''); ?>">
                </div>
                <div class="field">
                    <label>Correu electrònic</label>
                    <input type="email" name="email" id="contactEmail" required value="<?php echo htmlspecialchars($_POST['email'] ?? ''); ?>">
                </div>
                <div class="field">
                    <label>Missatge</label>
                    <textarea name="message" id="contactMessage" rows="4" required><?php echo htmlspecialchars($_POST['message'] ?? ''); ?></textarea>
                </div>
                <div class="checkbox-wrap">
                    <input type="checkbox" name="privacy" id="contactPrivacy" required <?php echo isset($_POST['privacy']) ? 'checked' : ''; ?>>
                    <label for="contactPrivacy">
                        He llegit i accepto la <a href="index.html#politica-privacitat" target="_blank">Política de Privacitat</a>.
                        Les meves dades seran tractades per respondre a la meva consulta.
                    </label>
                </div>
                <button type="submit" class="submit-btn" id="contactSubmitBtn">
                    <i class="fa-regular fa-envelope"></i> Enviar missatge
                </button>
            </form>

            <div class="contact-email">
                També pots escriure'ns directament a <a href="mailto:meteomaresme@gmail.com">meteomaresme@gmail.com</a>
            </div>

        <?php endif; ?>
    </div>

    <?php if (!isset($success) && !isset($error)): ?>
    <script>
        document.getElementById('contactForm').addEventListener('submit', function(e) {
            const submitBtn = document.getElementById('contactSubmitBtn');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviant...';
        });
    </script>
    <?php endif; ?>

</body>
</html>