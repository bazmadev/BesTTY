using System;
using System.Threading.Tasks;
using Windows.Security.Credentials.UI;

class Program {
    [STAThread]
    static int Main(string[] args) {
        try {
            if (args.Length > 0 && args[0] == "verify") {
                string prompt = args.Length > 1 ? args[1] : "Подтвердите вход в BesTTY";
                var reqOp = UserConsentVerifier.RequestVerificationAsync(prompt);
                var reqTask = System.WindowsRuntimeSystemExtensions.AsTask(reqOp);
                reqTask.Wait();
                var res = reqTask.Result;
                Console.WriteLine("RESULT:" + res);
                return res == UserConsentVerificationResult.Verified ? 0 : 1;
            } else {
                var checkOp = UserConsentVerifier.CheckAvailabilityAsync();
                var checkTask = System.WindowsRuntimeSystemExtensions.AsTask(checkOp);
                checkTask.Wait();
                var avail = checkTask.Result;
                Console.WriteLine("AVAIL:" + avail);
                return avail == UserConsentVerifierAvailability.Available ? 0 : 2;
            }
        } catch (Exception ex) {
            Console.WriteLine("ERROR:" + ex.Message);
            return 3;
        }
    }
}
