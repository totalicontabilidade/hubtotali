' Abre o robo-local.cmd sem janela: e o que a tarefa agendada chama,
' para nao piscar um prompt preto na tela de quem esta trabalhando.
Dim shell, pasta
Set shell = CreateObject("WScript.Shell")
pasta = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
shell.Run """" & pasta & "robo-local.cmd""", 0, False
