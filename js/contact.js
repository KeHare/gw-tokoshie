/* =========================================================
   お問い合わせフォーム
   - 入力途中の内容は自動保存（リロード/送信失敗でも消えない）
   - Formspree のエンドポイントを設定すれば AJAX 送信
   - 未設定でもメール送信（mailto）にフォールバックして必ず送れる
   ========================================================= */
(function () {
  "use strict";

  // ▼▼ Formspree を使う場合はここに発行された ID を入れてください ▼▼
  //   例) "https://formspree.io/f/abcdwxyz"
  //   空のままでも、送信はメールソフト起動（mailto）で機能します。
  var FORMSPREE_ENDPOINT = "";
  // 送信先メールアドレス（mailto フォールバック用）
  var FALLBACK_MAIL = "y.nagayama@gw-tokoshie.com";
  var STORAGE_KEY = "tokoshie_contact_draft";
  // ▲▲ 設定ここまで ▲▲

  var form = document.getElementById("contact-form");
  if (!form) return;

  var statusBox = document.getElementById("form-status");
  var submitBtn = form.querySelector('button[type="submit"]');

  /* ---------- 下書きの自動保存・復元（入力を絶対に失わない） ---------- */
  function fieldEls() {
    return Array.prototype.slice.call(
      form.querySelectorAll("input[name], textarea[name], select[name]")
    );
  }
  function saveDraft() {
    try {
      var data = {};
      fieldEls().forEach(function (el) {
        if (el.type === "checkbox") data[el.name] = el.checked;
        else data[el.name] = el.value;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function restoreDraft() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      fieldEls().forEach(function (el) {
        if (!(el.name in data)) return;
        if (el.type === "checkbox") el.checked = !!data[el.name];
        else el.value = data[el.name];
      });
    } catch (e) {}
  }
  function clearDraft() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }
  restoreDraft();
  form.addEventListener("input", saveDraft);

  /* ---------- バリデーション ---------- */
  function setInvalid(el, on) {
    var field = el.closest(".field");
    if (field) field.classList.toggle("invalid", on);
  }
  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }
  function validate() {
    var ok = true;
    fieldEls().forEach(function (el) {
      if (el.type === "checkbox") return;
      var required = el.hasAttribute("required");
      var empty = !el.value.trim();
      var bad = false;
      if (required && empty) bad = true;
      if (el.type === "email" && el.value && !validEmail(el.value)) bad = true;
      setInvalid(el, bad);
      if (bad && ok) el.focus();
      if (bad) ok = false;
    });
    var agree = form.querySelector('input[name="privacy"]');
    if (agree && !agree.checked) {
      setInvalid(agree, true);
      ok = false;
    } else if (agree) {
      setInvalid(agree, false);
    }
    return ok;
  }
  fieldEls().forEach(function (el) {
    el.addEventListener("blur", function () {
      if (el.type === "checkbox") return;
      var bad =
        (el.hasAttribute("required") && !el.value.trim()) ||
        (el.type === "email" && el.value && !validEmail(el.value));
      setInvalid(el, bad);
    });
  });

  /* ---------- ステータス表示 ---------- */
  function showStatus(type, html) {
    if (!statusBox) return;
    statusBox.className = "form__status show " + type;
    statusBox.innerHTML = html;
    statusBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function buildMailto() {
    var get = function (n) {
      var el = form.querySelector('[name="' + n + '"]');
      return el ? el.value : "";
    };
    var subject =
      "【お問い合わせ】" + (get("company") || "") + " " + (get("name") || "");
    var body =
      "■会社名: " + get("company") + "\n" +
      "■お名前: " + get("name") + "\n" +
      "■メール: " + get("email") + "\n" +
      "■電話: " + get("tel") + "\n" +
      "■ご相談内容: " + get("topic") + "\n\n" +
      "■お問い合わせ詳細:\n" + get("message") + "\n";
    return (
      "mailto:" +
      FALLBACK_MAIL +
      "?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(body)
    );
  }

  /* ---------- 送信 ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) {
      showStatus(
        "error",
        "未入力または形式に誤りのある項目があります。赤く表示された項目をご確認ください。<br>入力いただいた内容は保持されていますのでご安心ください。"
      );
      return;
    }

    // Formspree 未設定 → メールソフト起動でフォールバック送信
    if (!FORMSPREE_ENDPOINT) {
      window.location.href = buildMailto();
      showStatus(
        "warn",
        "ご利用のメールソフトを起動しました。開いた画面で<b>そのまま送信</b>してください。<br>" +
          "メールソフトが起動しない場合は、お手数ですが <a href='mailto:" +
          FALLBACK_MAIL +
          "'>" +
          FALLBACK_MAIL +
          "</a> 宛にお送りください。<br>" +
          "（入力内容はこの画面に保持されています）"
      );
      return;
    }

    // Formspree への AJAX 送信
    var original = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = "送信中…";

    fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(form),
    })
      .then(function (res) {
        if (res.ok) {
          form.reset();
          clearDraft();
          showStatus(
            "ok",
            "お問い合わせを受け付けました。担当者より追ってご連絡いたします。<br>ありがとうございました。"
          );
        } else {
          throw new Error("server");
        }
      })
      .catch(function () {
        showStatus(
          "error",
          "送信中にエラーが発生しました。お手数ですが <a href='" +
            buildMailto() +
            "'>メールでのお問い合わせ</a> をお試しください。<br>" +
            "入力内容は保持されていますので、再送信も可能です。"
        );
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.innerHTML = original;
      });
  });
})();
