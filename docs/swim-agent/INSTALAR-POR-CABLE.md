# Instalar PocketPal Coach en tu iPhone por cable

Guía para compilar la rama `feature/swim-agent-mvp` en el MacBook M2 Air con Xcode e instalarla en el iPhone 17 Pro Max (iOS 27) por cable. Sirve para probar el MVP 1: cargar un curso ficticio, elegir grupo y alumno, escribir o dictar una nota, revisarla, guardarla y volver a verla.

Solo datos ficticios. No cargues listados reales de niños hasta decidir cifrado, copia de iCloud e historial.

Estado a 21/10/2026: las pruebas, el lint y el typecheck pasan en Linux. La app no se ha compilado nunca para iOS, porque en Linux no se puede. La primera compilación real es la tuya.

Desde el 25/10/2026 el proyecto viene con firma automática y sin equipo ni perfiles ajenos (Debug, Release y Profiling): en Xcode solo eliges tu equipo y un bundle id. Tampoco está probado en un Mac.

## Antes de empezar: qué tienes

Abre la app **Terminal** del Mac y escribe cada orden, una por línea, pulsando Intro.

1. `sw_vers` → apunta la versión de macOS.
2. `xcodebuild -version` → apunta la versión de Xcode. Para instalar en un iPhone con iOS 27 casi seguro necesitas **Xcode 27**. Si tienes uno anterior, actualízalo desde la App Store.
3. `brew --version` → si dice «command not found», instala Homebrew con la orden que aparece en https://brew.sh y vuelve a abrir Terminal.

## 1. Herramientas (solo la primera vez)

1. `brew install node@22`
2. `echo 'export PATH="/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zshrc`
3. `source ~/.zshrc`
4. `node -v` → tiene que salir 22.21 o más.
5. `corepack enable`
6. `corepack prepare yarn@1.22.22 --activate`
7. `yarn -v` → tiene que salir 1.22.x.
8. `brew install cocoapods`
9. `pod --version` → 1.15.2 o más (1.16 y 1.17 valen).
10. `xcode-select -p` → tiene que acabar en `Xcode.app/Contents/Developer`. Si no: `sudo xcode-select -s /Applications/Xcode.app`.

## 2. Bajar la rama

Si no tienes el repo en el Mac:

1. `mkdir -p ~/Developer && cd ~/Developer`
2. `git clone https://github.com/JosebaDG/pocketpal-ai.git`
3. `cd pocketpal-ai`
4. `git checkout feature/swim-agent-mvp`

Si ya lo tienes:

1. `cd` a la carpeta del repo.
2. `git status` → si hay cambios tuyos sin guardar, guárdalos antes con `git stash`.
3. `git fetch origin`
4. `git checkout feature/swim-agent-mvp`
5. `git pull`

## 3. Preparar el proyecto

Todo desde la carpeta del repo.

1. `bash scripts/coach-ios-local-setup.sh` → crea cuatro archivos locales con valores de relleno (los mismos que usa la CI). No llevan secretos y git los ignora.
2. `yarn install` → tarda unos minutos.
3. `cd ios`
4. `pod install` → la primera vez puede tardar 10 o 15 minutos. Si tu CocoaPods es más nuevo, cambiará la línea `COCOAPODS:` del final de `ios/Podfile.lock`: no es un fallo y no hace falta guardarlo.
5. `cd ..`
6. `open ios/PocketPal.xcworkspace` → abre el **.xcworkspace**, nunca el .xcodeproj.
7. Si Xcode ofrece **Update to recommended settings** (un aviso amarillo a la izquierda), pulsa que no o déjalo sin tocar. Si lo aceptas, activa User Script Sandboxing y rompe los scripts de React Native («Sandbox: rsync … deny»).

## 4. Firma en Xcode

1. Xcode → menú **Xcode → Settings → Accounts**: comprueba que está tu Apple ID y tu equipo.
2. En la columna izquierda, pulsa el icono azul **PocketPal** de arriba del todo.
3. En **TARGETS**, elige **PocketPal** (no PocketPalTests).
4. Pestaña **Signing & Capabilities**, subpestaña **All**.
5. Comprueba que está marcado **Automatically manage signing** (ya viene así).
6. En **Team**, elige tu equipo.
7. En **Bundle Identifier**, cambia `ai.pocketpal` por uno tuyo, por ejemplo `com.josebadg.pocketpalcoach`. El original es del equipo de PocketPal y no te dejará usarlo.
8. Si tu equipo pone «(Personal Team)», borra con la papelera la capacidad **Siri** (y las de memoria si Xcode se queja). Con la cuenta de pago no hace falta.
9. Espera a que desaparezcan los avisos rojos de esa pantalla.
10. Plan B, solo si después de elegir tu equipo Xcode sigue enseñando un equipo que no es el tuyo, o sale «conflicting provisioning settings»: pestaña **Build Settings**, arriba **All** y **Combined**, y busca por turnos **Development Team**, **Provisioning Profile** y **Code Signing Identity**. Despliega cada una con el triángulo y, si debajo hay una fila **Any iOS SDK**, selecciónala y pulsa la tecla de borrar. Hazlo en Debug, Release y Profiling. Luego vuelve a Signing & Capabilities y elige tu equipo otra vez.

## 5. Preparar el iPhone

1. Conecta el iPhone al Mac con el cable y desbloquéalo.
2. Si pregunta «¿Confiar en este ordenador?», pulsa **Confiar** y pon el código.
3. En Xcode, arriba en el centro, abre el selector de destino y elige **tu iPhone** (no un simulador).
4. En el iPhone: **Ajustes → Privacidad y seguridad → Modo de desarrollador** → actívalo. Se reinicia; al volver, confirma **Activar**. La opción aparece después de conectar el iPhone a Xcode.
5. Si Xcode dice «Preparing iPhone» o «Copying shared cache», espera a que termine.

## 6. Compilar e instalar (modo Debug, en casa)

En Debug la app pide el código JavaScript al Mac por la wifi.

1. El iPhone y el Mac en la **misma wifi**.
2. Abre una segunda ventana de Terminal en la carpeta del repo y escribe `yarn start`. Déjala abierta.
3. En Xcode: **Product → Run** (o Cmd+R). La primera vez tarda 10 o 20 minutos.
4. Si el iPhone dice «Desarrollador no fiable»: **Ajustes → General → VPN y gestión de dispositivos** → tu cuenta → **Confiar**. Vuelve a pulsar Run.
5. Si macOS pide permiso para que Xcode o la Terminal busquen dispositivos en la red local, pulsa **Permitir**.

## 7. Usarla sin el Mac (modo Release, opcional)

Para llevarla a la piscina sin Metro ni wifi:

1. Xcode → **Product → Scheme → Edit Scheme…** → **Run** → **Build Configuration: Release** → Close.
2. **Product → Run**. Release ya firma con Apple Development: no hay que tocar Code Signing Identity.
3. Con un Apple ID gratis la app deja de abrirse a los 7 días: vuelve a pulsar Run. Con la cuenta de pago dura un año.

## 8. Comprobar el ciclo en el móvil

La primera vez la app enseña la bienvenida de PocketPal. Pásala; no hace falta bajar ningún modelo.

1. Abre el menú (las tres rayas) y toca **Coach (prueba)**.
2. Arriba tiene que poner «MVP 1 · solo datos ficticios».
3. Toca **Cargar curso de prueba (ficticio)**.
4. Tiene que poner «4 grupos · 10 inscritos · 1 en lista de espera». Toca **Confirmar importación**.
5. Toca el grupo **Miércoles 17:00**. Tiene que avisar de 1 en lista de espera y no enseñar a «Lía Espera».
6. Toca **Fran Ejemplo**.
7. Escribe una nota, o toca el micrófono del teclado y díctala.
8. Toca **Revisar nota**: comprueba alumno, grupo, sesión y el texto exacto.
9. Toca **Guardar** → tiene que poner «Guardada.» y la nota sale abajo, en «5 · Notas de Fran Ejemplo».
10. Escribe la misma nota otra vez, Revisar y Guardar → tiene que poner «ya estaba guardada: no se ha duplicado», y abajo sigue habiendo una.
11. Cierra la app del todo (desliza hacia arriba en el selector de apps) y ábrela otra vez.
12. Menú → Coach (prueba) → el curso se abre solo → Miércoles 17:00 → Fran Ejemplo → la nota sigue ahí.
13. Opcional: pon el modo avión y prueba a dictar. Si dicta, el dictado va en el móvil; si no, depende de Apple, no de la app.

Si los pasos 9, 10 y 12 salen bien, el ciclo del MVP 1 está cerrado en tu iPhone.

## Errores típicos

| Qué sale | Qué hacer |
|---|---|
| `pod: command not found` | `brew install cocoapods` |
| `pod install` falla al bajar | `pod repo update` y repite `pod install` |
| `pod install` no encuentra node | Repite `bash scripts/coach-ios-local-setup.sh` con Node 22 activo, o borra `ios/.xcode.env.local` y repítelo |
| `GoogleService-Info.plist` o `Env.xcconfig` no encontrado | `bash scripts/coach-ios-local-setup.sh` |
| `'React/RCTBridge.h' file not found` o «No such module» | Abriste el .xcodeproj: cierra y abre el .xcworkspace |
| «Failed to register bundle identifier» | Cambia el Bundle Identifier por otro único |
| «Personal development teams … do not support the Siri capability» | Borra la capacidad Siri (paso 4.8) |
| «Signing for "PocketPal" requires a development team» | Elige tu equipo (paso 4.6) |
| «Conflicting provisioning settings» o sale un equipo que no es el tuyo | Paso 4.10 |
| «Developer Mode disabled» | Paso 5.4 |
| Xcode no ofrece el iPhone o dice que no soporta iOS 27 | Actualiza a Xcode 27, o Xcode → Settings → Components → instala iOS 27 |
| «Untrusted Developer» al abrir | Paso 6.4 |
| Pantalla roja «No bundle URL present» o «Could not connect to development server» | `yarn start` abierto y misma wifi, o usa Release (paso 7) |
| «Command PhaseScriptExecution failed» en «Bundle React Native code and images» | Mira el primer error rojo de ese paso; suele ser node (`ios/.xcode.env.local`) o falta `.env` |
| «Sandbox: rsync … deny» | Build Settings → User Script Sandboxing → No (pasa si se aceptó «Update to recommended settings», paso 3.7) |
| Errores de C++ dentro de Pods (fmt, folly, Yoga…) | Puede ser React Native 0.82 con Xcode 27: copia el primer error rojo completo y pásamelo |

Si Xcode da un error que no está aquí, copia el **primer** mensaje rojo completo (no el último) y pásalo.

## Qué no hace este MVP

- No usa modelos de IA: el dictado es el del teclado del iPhone.
- No importa Excel en la pantalla: solo el curso de prueba o un JSON con el formato de `CoachRoster`.
- No hay voz (TTS), Core AI ni informes trimestrales.
- No cifra nada: por eso solo datos ficticios.
